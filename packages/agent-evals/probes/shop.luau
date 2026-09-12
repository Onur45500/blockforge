-- Runtime structure probe for the shop scenario.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ServerScriptService = game:GetService("ServerScriptService")

local remotes = ReplicatedStorage:WaitForChild("Remotes", 10)
local buyRemote = remotes and remotes:FindFirstChild("BuyItem") or ReplicatedStorage:FindFirstChild("BuyItem")
assert(buyRemote, "FAIL: Remotes/BuyItem (or ReplicatedStorage.BuyItem) missing")
assert(buyRemote:IsA("RemoteEvent"), "FAIL: BuyItem must be a RemoteEvent")

local foundServerHandler = false
for _, descendant in ServerScriptService:GetDescendants() do
	if descendant:IsA("LuaSourceContainer") then
		local ok, source = pcall(function()
			return descendant.Source
		end)
		if ok and string.find(source, "BuyItem", 1, true)
			and string.find(source, "OnServerEvent", 1, true)
		then
			foundServerHandler = true
			break
		end
	end
end
assert(foundServerHandler, "FAIL: no server-side BuyItem handler found")

print("PASS")
