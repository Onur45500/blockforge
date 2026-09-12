/**
 * REFERENCE ONLY — copy into src/server/ for a chase dummy with PathfindingService.
 * Not compiled from docs/examples.
 *
 * Expects anchored ChaseNpc under Workspace.World. Dummy stays Anchored; waypoints
 * are followed with PivotTo (validate-world forbids unanchored scenery).
 * Do not vendor SimplePath — ComputeAsync + GetWaypoints is the MVP.
 */
import { PathfindingService, Players, Workspace } from "@rbxts/services";

const RETARGET_SECONDS = 0.8;
const STOP_DISTANCE = 6;
const STRAIGHT_STEP = 4;

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

function nearestRoot(from: Vector3): BasePart | undefined {
	let best: BasePart | undefined;
	let bestDist = math.huge;
	for (const player of Players.GetPlayers()) {
		const character = player.Character;
		const root = character?.FindFirstChild("HumanoidRootPart");
		if (root === undefined || !root.IsA("BasePart")) {
			continue;
		}
		const dist = root.Position.sub(from).Magnitude;
		if (dist < bestDist) {
			bestDist = dist;
			best = root;
		}
	}
	return best;
}

function standCFrame(npc: BasePart, position: Vector3): CFrame {
	return new CFrame(position.X, npc.Position.Y, position.Z);
}

const npc = findWorldPart("ChaseNpc");
if (npc !== undefined) {
	npc.Anchored = true;
	npc.CanCollide = false;
	const path = PathfindingService.CreatePath({
		AgentRadius: 2,
		AgentHeight: 5,
		AgentCanJump: false,
	});

	task.spawn(() => {
		while (true) {
			const target = nearestRoot(npc.Position);
			if (target === undefined) {
				task.wait(RETARGET_SECONDS);
				continue;
			}
			const delta = target.Position.sub(npc.Position);
			const gap = new Vector3(delta.X, 0, delta.Z);
			if (gap.Magnitude <= STOP_DISTANCE) {
				task.wait(RETARGET_SECONDS);
				continue;
			}

			path.ComputeAsync(npc.Position, target.Position);
			if (path.Status === Enum.PathStatus.Success) {
				const waypoints = path.GetWaypoints();
				for (const waypoint of waypoints) {
					if (waypoint.Action === Enum.PathWaypointAction.Jump) {
						continue;
					}
					npc.PivotTo(standCFrame(npc, waypoint.Position));
					task.wait(0.12);
				}
			} else {
				const dir = gap.Unit;
				const step = npc.Position.add(dir.mul(STRAIGHT_STEP));
				npc.PivotTo(standCFrame(npc, step));
				task.wait(0.2);
			}
			task.wait(RETARGET_SECONDS);
		}
	});
}
