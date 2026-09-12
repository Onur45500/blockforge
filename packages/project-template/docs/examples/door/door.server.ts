/**
 * REFERENCE ONLY — copy into src/server/ for a ProximityPrompt door.
 * Not compiled from docs/examples.
 *
 * Expects an anchored Part named ShopDoor under Workspace.World.
 */
import { Workspace } from "@rbxts/services";

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

const door = findWorldPart("ShopDoor");
if (door !== undefined) {
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = "Open";
	prompt.ObjectText = "Door";
	prompt.HoldDuration = 0;
	prompt.MaxActivationDistance = 10;
	prompt.RequiresLineOfSight = false;
	prompt.Parent = door;

	let open = false;
	prompt.Triggered.Connect(() => {
		open = !open;
		door.CanCollide = !open;
		door.Transparency = open ? 0.7 : 0;
		prompt.ActionText = open ? "Close" : "Open";
	});
}
