-- Runtime probe for teleport scenario (run-in-roblox).

local Workspace = game:GetService("Workspace")
local world = Workspace:WaitForChild("World", 10)
assert(world, "FAIL: Workspace.World missing")

local pads = {}
for _, desc in world:GetDescendants() do
	if desc:IsA("BasePart") then
		local lower = string.lower(desc.Name)
		if string.find(lower, "teleport", 1, true)
			or string.find(lower, "pad", 1, true)
			or string.find(lower, "portal", 1, true)
		then
			table.insert(pads, desc)
		end
	end
end

assert(#pads >= 2, "FAIL: expected at least 2 teleport/pad parts under World, found " .. tostring(#pads))
for _, pad in pads do
	assert(pad.Anchored == true, "FAIL: " .. pad.Name .. " not Anchored")
end

print("PASS")
