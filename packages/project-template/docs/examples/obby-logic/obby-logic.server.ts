/**
 * REFERENCE ONLY — copy into src/server/ for kill brick + checkpoint.
 * Not compiled from docs/examples.
 *
 * Expects KillBrick and Checkpoint1 Parts under Workspace.World
 * (see docs/examples/ObbySegment.model.json).
 */
import { Players, Workspace } from "@rbxts/services";

const TOUCH_DEBOUNCE = 0.75;
const lastTouch = new Map<number, number>();
const checkpoints = new Map<number, CFrame>();

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

function defaultSpawnCFrame(): CFrame {
	const world = Workspace.FindFirstChild("World");
	if (world !== undefined) {
		const spawn = world.FindFirstChildWhichIsA("SpawnLocation", true);
		if (spawn !== undefined) {
			return spawn.CFrame.add(new Vector3(0, 3, 0));
		}
	}
	return new CFrame(0, 15, 0);
}

function teleportToCheckpoint(player: Player): void {
	const character = player.Character;
	if (character === undefined) {
		return;
	}
	const root = character.FindFirstChild("HumanoidRootPart");
	if (root === undefined || !root.IsA("BasePart")) {
		return;
	}
	const saved = checkpoints.get(player.UserId);
	root.CFrame = saved ?? defaultSpawnCFrame();
}

function onTouched(player: Player, action: "kill" | "checkpoint", part: BasePart): void {
	const now = os.clock();
	const previous = lastTouch.get(player.UserId);
	if (previous !== undefined && now - previous < TOUCH_DEBOUNCE) {
		return;
	}
	lastTouch.set(player.UserId, now);

	if (action === "checkpoint") {
		checkpoints.set(player.UserId, part.CFrame.add(new Vector3(0, 3, 0)));
		return;
	}
	teleportToCheckpoint(player);
}

function bindPart(name: string, action: "kill" | "checkpoint"): void {
	const part = findWorldPart(name);
	if (part === undefined) {
		return;
	}
	part.Touched.Connect((hit) => {
		const character = hit.Parent;
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player !== undefined) {
			onTouched(player, action, part);
		}
	});
}

bindPart("KillBrick", "kill");
bindPart("Checkpoint1", "checkpoint");

Players.PlayerRemoving.Connect((player) => {
	lastTouch.delete(player.UserId);
	checkpoints.delete(player.UserId);
});
