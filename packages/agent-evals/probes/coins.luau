-- Runtime structure probe for the coins leaderboard scenario.

local Workspace = game:GetService("Workspace")
local ServerScriptService = game:GetService("ServerScriptService")
local world = Workspace:WaitForChild("World", 10)
assert(world, "FAIL: Workspace.World missing")

local coinPad = world:FindFirstChild("CoinPad", true)
assert(coinPad, "FAIL: CoinPad missing under World")
assert(coinPad:IsA("BasePart"), "FAIL: CoinPad is not a BasePart")
assert(coinPad.Anchored == true, "FAIL: CoinPad not Anchored")

local foundLeaderboardLogic = false
for _, descendant in ServerScriptService:GetDescendants() do
	if descendant:IsA("LuaSourceContainer") then
		local ok, source = pcall(function()
			return descendant.Source
		end)
		if ok and string.find(source, "leaderstats", 1, true)
			and string.find(source, "Coins", 1, true)
		then
			foundLeaderboardLogic = true
			break
		end
	end
end
assert(foundLeaderboardLogic, "FAIL: no server script contains leaderstats + Coins logic")

print("PASS")
