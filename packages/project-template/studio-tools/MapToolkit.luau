-- Blockforge MapToolkit (original). Rojo: ReplicatedStorage.Blockforge.MapToolkit
-- Grounding, corner AABB, occupancy scatter, coplanar-face (z-fighting) audit.
-- Agents: require() this module after Rojo sync. Do not paste this source into execute_luau.

local Players = game:GetService("Players")
local Workspace = game:GetService("Workspace")

local VERSION = "0.5.0"

local occupancy = {} -- string keys "x,z" -> true, session-local

local MapToolkit = {}

function MapToolkit.version()
	return VERSION
end

local function roundGrid(n, cell)
	return math.floor(n / cell + 0.5)
end

function MapToolkit.cornerAabb(part)
	local cf = part.CFrame
	local size = part.Size
	local hx, hy, hz = size.X / 2, size.Y / 2, size.Z / 2
	local minV = Vector3.new(math.huge, math.huge, math.huge)
	local maxV = Vector3.new(-math.huge, -math.huge, -math.huge)
	for _, sx in ipairs({ -1, 1 }) do
		for _, sy in ipairs({ -1, 1 }) do
			for _, sz in ipairs({ -1, 1 }) do
				local world = cf:PointToWorldSpace(Vector3.new(sx * hx, sy * hy, sz * hz))
				minV = Vector3.new(math.min(minV.X, world.X), math.min(minV.Y, world.Y), math.min(minV.Z, world.Z))
				maxV = Vector3.new(math.max(maxV.X, world.X), math.max(maxV.Y, world.Y), math.max(maxV.Z, world.Z))
			end
		end
	end
	return minV, maxV
end

function MapToolkit.aabbOverlap(aMin, aMax, bMin, bMax)
	return aMin.X <= bMax.X
		and aMax.X >= bMin.X
		and aMin.Y <= bMax.Y
		and aMax.Y >= bMin.Y
		and aMin.Z <= bMax.Z
		and aMax.Z >= bMin.Z
end

function MapToolkit.groundY(position, exclude)
	local origin = Vector3.new(position.X, position.Y + 500, position.Z)
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = exclude or {}
	local hit = Workspace:Raycast(origin, Vector3.new(0, -2000, 0), params)
	if hit then
		return hit.Position.Y, hit.Instance
	end
	return nil, nil
end

function MapToolkit.groundModel(model, exclude)
	if not model.PrimaryPart then
		return false, "Model has no PrimaryPart"
	end
	local y, inst = MapToolkit.groundY(model.PrimaryPart.Position, exclude)
	if y == nil then
		return false, "No ground under model"
	end
	local pivot = model:GetPivot()
	-- Place so the lowest corner sits on the hit Y (caller Y is ignored).
	local lowest = math.huge
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") then
			local mn = select(1, MapToolkit.cornerAabb(d))
			lowest = math.min(lowest, mn.Y)
		end
	end
	if lowest == math.huge then
		lowest = pivot.Position.Y
	end
	local delta = y - lowest
	model:PivotTo(pivot + Vector3.new(0, delta, 0))
	return true, inst and inst:GetFullName() or "grounded"
end

function MapToolkit.occupy(x, z, cell)
	cell = cell or 4
	local key = tostring(roundGrid(x, cell)) .. "," .. tostring(roundGrid(z, cell))
	occupancy[key] = true
end

function MapToolkit.occupied(x, z, cell)
	cell = cell or 4
	local key = tostring(roundGrid(x, cell)) .. "," .. tostring(roundGrid(z, cell))
	return occupancy[key] == true
end

function MapToolkit.clearOccupancy()
	occupancy = {}
end

function MapToolkit.scatter(count, origin, radius, cell, maxTries)
	count = count or 1
	radius = radius or 40
	cell = cell or 4
	maxTries = maxTries or 40
	local spots = {}
	for _ = 1, count do
		local placed = false
		for _ = 1, maxTries do
			local angle = math.random() * math.pi * 2
			local dist = math.sqrt(math.random()) * radius
			local x = origin.X + math.cos(angle) * dist
			local z = origin.Z + math.sin(angle) * dist
			if not MapToolkit.occupied(x, z, cell) then
				local y = MapToolkit.groundY(Vector3.new(x, origin.Y, z))
				if y ~= nil then
					MapToolkit.occupy(x, z, cell)
					table.insert(spots, Vector3.new(x, y, z))
					placed = true
					break
				end
			end
		end
		if not placed then
			break
		end
	end
	return spots
end

local function facingDot(a, b)
	return math.abs(a.CFrame.LookVector:Dot(b.CFrame.LookVector))
end

function MapToolkit.auditZFight(root, epsilon)
	root = root or Workspace:FindFirstChild("World") or Workspace
	epsilon = epsilon or 0.05
	local parts = {}
	for _, d in ipairs(root:GetDescendants()) do
		if d:IsA("BasePart") then
			table.insert(parts, d)
		end
	end
	local issues = {}
	for i = 1, #parts do
		local aMin, aMax = MapToolkit.cornerAabb(parts[i])
		for j = i + 1, #parts do
			local bMin, bMax = MapToolkit.cornerAabb(parts[j])
			if MapToolkit.aabbOverlap(aMin, aMax, bMin, bMax) then
				local dy = math.min(aMax.Y, bMax.Y) - math.max(aMin.Y, bMin.Y)
				if dy >= 0 and dy < epsilon and facingDot(parts[i], parts[j]) > 0.95 then
					table.insert(issues, {
						a = parts[i]:GetFullName(),
						b = parts[j]:GetFullName(),
						kind = "coplanar-face",
					})
				end
			end
		end
	end
	return issues
end

function MapToolkit.auditOverlaps(root)
	root = root or Workspace:FindFirstChild("World") or Workspace
	local parts = {}
	for _, d in ipairs(root:GetDescendants()) do
		if d:IsA("BasePart") then
			table.insert(parts, d)
		end
	end
	local issues = {}
	for i = 1, #parts do
		local aMin, aMax = MapToolkit.cornerAabb(parts[i])
		for j = i + 1, #parts do
			if parts[i].Parent ~= parts[j].Parent then
				local bMin, bMax = MapToolkit.cornerAabb(parts[j])
				if MapToolkit.aabbOverlap(aMin, aMax, bMin, bMax) then
					table.insert(issues, {
						a = parts[i]:GetFullName(),
						b = parts[j]:GetFullName(),
						kind = "aabb-overlap",
					})
				end
			end
		end
	end
	return issues
end

function MapToolkit.auditRigs(root)
	root = root or Workspace
	local issues = {}
	for _, d in ipairs(root:GetDescendants()) do
		if d:IsA("Motor6D") then
			if d.Part0 == nil or d.Part1 == nil then
				table.insert(issues, { motor = d:GetFullName(), kind = "broken-motor6d" })
			end
		end
	end
	return issues
end

function MapToolkit.auditOffscreenGui(player)
	player = player or Players.LocalPlayer
	local issues = {}
	if not player then
		return { { kind = "no-local-player" } }
	end
	local pg = player:FindFirstChild("PlayerGui")
	if not pg then
		return issues
	end
	local camera = Workspace.CurrentCamera
	local vp = camera and camera.ViewportSize or Vector2.new(1920, 1080)
	for _, gui in ipairs(pg:GetDescendants()) do
		if gui:IsA("GuiObject") and gui.Visible then
			local pos = gui.AbsolutePosition
			local size = gui.AbsoluteSize
			if pos.X + size.X < 0 or pos.Y + size.Y < 0 or pos.X > vp.X or pos.Y > vp.Y then
				table.insert(issues, { path = gui:GetFullName(), kind = "off-screen-ui" })
			end
		end
	end
	return issues
end

return MapToolkit
