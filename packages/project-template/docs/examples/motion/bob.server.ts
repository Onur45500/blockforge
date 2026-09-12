/**
 * REFERENCE ONLY — copy into src/server/ to bob a scenery part.
 * Not compiled from docs/examples.
 *
 * Expects an anchored Part named BobMarker under Workspace.World.
 */
import { TweenService, Workspace } from "@rbxts/services";

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

const marker = findWorldPart("BobMarker");
if (marker !== undefined) {
	const info = new TweenInfo(1.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, -1, true);
	const up = marker.Position.add(new Vector3(0, 2, 0));
	TweenService.Create(marker, info, { Position: up }).Play();
}
