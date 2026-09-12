-- Runtime probe for obby scenario (run-in-roblox).
-- Exits with print("PASS") or error("FAIL: ...").

local Workspace = game:GetService("Workspace")
local world = Workspace:WaitForChild("World", 10)
assert(world, "FAIL: Workspace.World missing")

local function findNamed(root, name)
	for _, desc in root:GetDescendants() do
		if desc.Name == name then
			return desc
		end
	end
	return root:FindFirstChild(name, true)
end

local checkpoint = findNamed(world, "Checkpoint1")
local kill = findNamed(world, "KillBrick")
assert(checkpoint, "FAIL: Checkpoint1 missing under World")
assert(kill, "FAIL: KillBrick missing under World")
assert(checkpoint:IsA("BasePart"), "FAIL: Checkpoint1 is not a BasePart")
assert(kill:IsA("BasePart"), "FAIL: KillBrick is not a BasePart")
assert(checkpoint.Anchored == true, "FAIL: Checkpoint1 not Anchored")
assert(kill.Anchored == true, "FAIL: KillBrick not Anchored")

print("PASS")
