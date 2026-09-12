/**
 * REFERENCE ONLY — copy into src/server/ for a patrol dummy.
 * Not compiled from docs/examples.
 *
 * Expects an anchored Part named NpcMarker under Workspace.World
 * (see NpcMarker.model.json).
 */
import { Workspace } from "@rbxts/services";

const WAYPOINTS = [new Vector3(20, 12, 10), new Vector3(28, 12, 10), new Vector3(28, 12, 18)];
const DWELL_SECONDS = 2;

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

const marker = findWorldPart("NpcMarker");
if (marker !== undefined) {
	task.spawn(() => {
		let index = 0;
		while (true) {
			const target = WAYPOINTS[index];
			if (target !== undefined) {
				marker.CFrame = new CFrame(target);
			}
			index = (index + 1) % WAYPOINTS.size();
			task.wait(DWELL_SECONDS);
		}
	});
}
