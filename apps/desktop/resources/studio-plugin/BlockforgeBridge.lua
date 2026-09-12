--[[
  BlockforgeBridge — Studio plugin that streams Play Output + Workspace.World
  state to Blockforge (http://127.0.0.1:34873).

  Install via Blockforge Doctor → Install bridge plugin, or copy into
  %LOCALAPPDATA%\Roblox\Plugins\ (Windows) / ~/Documents/Roblox/Plugins/ (macOS).
]]

local HttpService = game:GetService("HttpService")
local LogService = game:GetService("LogService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ScriptContext = game:GetService("ScriptContext")
local ServerScriptService = game:GetService("ServerScriptService")
local Workspace = game:GetService("Workspace")

-- Play clones this plugin into Client + Server. Only Edit + Play Server can
-- HttpService:RequestAsync to 127.0.0.1. Do not gate on IsRunning() — it is
-- often still false when the Play client copy first executes.
local function isPlayClient()
	if RunService:IsClient() and not RunService:IsServer() then
		return true
	end
	local ok, localPlayer = pcall(function()
		return Players.LocalPlayer
	end)
	return ok and localPlayer ~= nil and not RunService:IsServer()
end

if isPlayClient() then
	return
end

local BRIDGE_PORT = 34873
local BRIDGE_URL = ("http://127.0.0.1:%d/log"):format(BRIDGE_PORT)
local STATE_URL = ("http://127.0.0.1:%d/state"):format(BRIDGE_PORT)
local EXPORT_URL = ("http://127.0.0.1:%d/export"):format(BRIDGE_PORT)
local HEALTH_URL = ("http://127.0.0.1:%d/health"):format(BRIDGE_PORT)
local FLUSH_INTERVAL = 0.5
local STATE_INTERVAL = 3
local MAX_BATCH = 40
local MAX_WORLD_CHILDREN = 200

local toolbar = plugin:CreateToolbar("Blockforge")
local button = toolbar:CreateButton(
	"Bridge",
	"Blockforge Studio Output bridge (streams Play errors + World state)",
	""
)
button.ClickableWhenViewportHidden = true

local connected = false
local queue = {}
local lastHealthOk = false
local lastStateAt = 0

local function setStatus(ok, detail)
	connected = ok
	lastHealthOk = ok
	button:SetActive(ok)
	if detail then
		print(("[BlockforgeBridge] %s"):format(detail))
	end
end

local function levelFromMessageType(messageType)
	local t = typeof(messageType) == "EnumItem" and messageType.Name or tostring(messageType)
	t = string.lower(t)
	if string.find(t, "error", 1, true) then
		return "error"
	end
	if string.find(t, "warning", 1, true) then
		return "warning"
	end
	return "info"
end

local function enqueue(level, message, source, stack, backfill)
	if #queue >= 200 then
		table.remove(queue, 1)
	end
	table.insert(queue, {
		ts = DateTime.now():ToIsoDate(),
		level = level,
		message = tostring(message or ""),
		source = source and tostring(source) or nil,
		stack = stack and tostring(stack) or nil,
		running = RunService:IsRunning(),
		isStudio = RunService:IsStudio(),
		backfill = backfill == true or nil,
	})
end

local function postJson(url, payload)
	if isPlayClient() then
		return false
	end
	local okEncode, body = pcall(function()
		return HttpService:JSONEncode(payload)
	end)
	if not okEncode or type(body) ~= "string" then
		-- Never surface encode failures as game ScriptContext/LogService errors.
		warn("[BlockforgeBridge] JSONEncode failed; dropping payload")
		return false
	end
	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = url,
			Method = "POST",
			Headers = {
				["Content-Type"] = "application/json",
			},
			Body = body,
		})
	end)
	if not ok then
		return false
	end
	return result.Success == true or (result.StatusCode and result.StatusCode >= 200 and result.StatusCode < 300)
end

local function postBatch(entries)
	if #entries == 0 then
		return false
	end
	return postJson(BRIDGE_URL, { entries = entries })
end

local function flush()
	if #queue == 0 then
		return
	end
	local batch = {}
	while #queue > 0 and #batch < MAX_BATCH do
		table.insert(batch, table.remove(queue, 1))
	end
	local ok = postBatch(batch)
	if not ok then
		for i = #batch, 1, -1 do
			table.insert(queue, 1, batch[i])
		end
		if lastHealthOk and not isPlayClient() then
			setStatus(false, "Bridge unreachable — is Blockforge open with a project?")
		end
	elseif not connected then
		setStatus(true, "Connected to Blockforge bridge on port " .. tostring(BRIDGE_PORT))
	end
end

local function checkHealth()
	if isPlayClient() then
		return false
	end
	local ok, result = pcall(function()
		return HttpService:RequestAsync({
			Url = HEALTH_URL,
			Method = "GET",
		})
	end)
	if ok and result and (result.Success or (result.StatusCode == 200)) then
		if not lastHealthOk then
			setStatus(true, "Health OK — streaming Play Output to Blockforge")
		end
		return true
	end
	if lastHealthOk and not isPlayClient() then
		setStatus(false, "Lost connection to Blockforge bridge")
	end
	return false
end

local function vectorToArray(v)
	if typeof(v) ~= "Vector3" then
		return nil
	end
	return { v.X, v.Y, v.Z }
end

local function colorToArray(color)
	if typeof(color) ~= "Color3" then
		return nil
	end
	return { color.R, color.G, color.B }
end

local function serializeWorldNode(instance, budget)
	if budget.remaining <= 0 then
		return nil
	end
	budget.remaining -= 1

	local node = {
		Name = instance.Name,
		ClassName = instance.ClassName,
	}

	if instance:IsA("BasePart") then
		node.Properties = {
			Anchored = instance.Anchored,
			CanCollide = instance.CanCollide,
			Position = vectorToArray(instance.Position),
			Orientation = vectorToArray(instance.Orientation),
			Size = vectorToArray(instance.Size),
			Color = colorToArray(instance.Color),
			Material = instance.Material.Name,
			Transparency = instance.Transparency,
		}
	end

	local children = {}
	for _, child in instance:GetChildren() do
		if budget.remaining <= 0 then
			break
		end
		if child:IsA("BasePart") or child:IsA("Model") or child:IsA("Folder") then
			local serialized = serializeWorldNode(child, budget)
			if serialized then
				table.insert(children, serialized)
			end
		end
	end
	if #children > 0 then
		node.Children = children
	end
	return node
end

local function collectWorldExport()
	local world = Workspace:FindFirstChild("World")
	if not world then
		return nil
	end
	return {
		filename = "StudioWorld.model.json",
		content = serializeWorldNode(world, { remaining = MAX_WORLD_CHILDREN + 1 }),
	}
end

local function collectWorldState()
	local world = Workspace:FindFirstChild("World")
	local worldChildren = {}
	local spawnLocations = {}

	if world then
		for _, desc in world:GetDescendants() do
			if #worldChildren >= MAX_WORLD_CHILDREN then
				break
			end
			if desc:IsA("BasePart") or desc:IsA("Model") or desc:IsA("Folder") then
				local entry = {
					name = desc.Name,
					className = desc.ClassName,
				}
				if desc:IsA("BasePart") then
					entry.position = vectorToArray(desc.Position)
					entry.anchored = desc.Anchored
					entry.size = vectorToArray(desc.Size)
				end
				table.insert(worldChildren, entry)
			end
			if desc:IsA("SpawnLocation") then
				table.insert(spawnLocations, {
					name = desc.Name,
					position = vectorToArray(desc.Position),
					enabled = desc.Enabled,
				})
			end
		end
	end

	local serverScripts = {}
	local ts = ServerScriptService:FindFirstChild("TS")
	if ts then
		for _, child in ts:GetDescendants() do
			if child:IsA("BaseScript") or child:IsA("ModuleScript") then
				table.insert(serverScripts, child.Name)
			end
		end
	end

	return {
		ts = DateTime.now():ToIsoDate(),
		running = RunService:IsRunning(),
		worldPresent = world ~= nil,
		worldChildren = worldChildren,
		spawnLocations = spawnLocations,
		serverScripts = serverScripts,
		rojoTsPresent = ts ~= nil,
	}
end

local function postState()
	local payload = collectWorldState()
	local ok = postJson(STATE_URL, payload)
	if ok then
		local worldExport = collectWorldExport()
		if worldExport then
			postJson(EXPORT_URL, { exports = { worldExport } })
		end
		lastStateAt = os.clock()
	end
	return ok
end

-- Backfill messages printed before this plugin loaded (Play reload).
do
	local ok, history = pcall(function()
		return LogService:GetLogHistory()
	end)
	if ok and typeof(history) == "table" then
		for _, item in history do
			local message = item.message or item.Message
			local messageType = item.messageType or item.MessageType
			if message then
				enqueue(levelFromMessageType(messageType), message, "LogHistory", nil, true)
			end
		end
	end
end

LogService.MessageOut:Connect(function(message, messageType)
	enqueue(levelFromMessageType(messageType), message, "LogService", nil)
end)

ScriptContext.Error:Connect(function(message, stackTrace, _script)
	enqueue("error", message, "ScriptContext", stackTrace)
end)

local function onWorldTreeChanged()
	-- Debounce via lastStateAt; main loop also posts every STATE_INTERVAL.
	if os.clock() - lastStateAt > 0.5 then
		postState()
	end
end

Workspace.ChildAdded:Connect(function(child)
	if child.Name == "World" then
		onWorldTreeChanged()
		child.ChildAdded:Connect(function()
			onWorldTreeChanged()
		end)
		child.ChildRemoved:Connect(function()
			onWorldTreeChanged()
		end)
	end
end)

Workspace.ChildRemoved:Connect(function(child)
	if child.Name == "World" then
		onWorldTreeChanged()
	end
end)

local existingWorld = Workspace:FindFirstChild("World")
if existingWorld then
	existingWorld.ChildAdded:Connect(function()
		onWorldTreeChanged()
	end)
	existingWorld.ChildRemoved:Connect(function()
		onWorldTreeChanged()
	end)
end

task.spawn(function()
	local elapsed = 0
	while true do
		if isPlayClient() then
			return
		end
		checkHealth()
		flush()
		elapsed += FLUSH_INTERVAL
		if elapsed >= STATE_INTERVAL then
			elapsed = 0
			postState()
		end
		task.wait(FLUSH_INTERVAL)
	end
end)

button.Click:Connect(function()
	if checkHealth() then
		enqueue("info", "BlockforgeBridge ping", "plugin", nil)
		flush()
		postState()
		setStatus(true, "Ping + state sent to Blockforge")
	else
		setStatus(false, "Cannot reach http://127.0.0.1:" .. tostring(BRIDGE_PORT) .. " — open a project in Blockforge")
	end
end)

-- Immediate first state + flush of backfill
task.defer(function()
	flush()
	postState()
end)

print("[BlockforgeBridge] loaded — streaming to " .. BRIDGE_URL)
