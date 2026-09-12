/**
 * REFERENCE ONLY — copy into src/server/ for a one-plot tycoon dropper.
 * Not compiled from docs/examples.
 *
 * Expects Dropper and TycoonCollector under Workspace.World.
 * Drops move toward the collector; touching a TycoonDrop pays coins and destroys it.
 */
// blockforge:dynamic-parts — TycoonDrop blobs are runtime Parts, not scenery.
import { Players, Workspace } from "@rbxts/services";

const DROP_EVERY = 3;
const COLLECT_VALUE = 2;
const TOUCH_DEBOUNCE = 0.5;
const MOVE_STEPS = 20;
const MOVE_STEP_WAIT = 0.15;
const lastCollect = new Map<number, number>();

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

function coinsValue(player: Player): IntValue | undefined {
	const stats = player.FindFirstChild("leaderstats");
	const coins = stats?.FindFirstChild("Coins");
	return coins !== undefined && coins.IsA("IntValue") ? coins : undefined;
}

function tryCollect(player: Player, blob: BasePart): void {
	const now = os.clock();
	const previous = lastCollect.get(player.UserId);
	if (previous !== undefined && now - previous < TOUCH_DEBOUNCE) {
		return;
	}
	lastCollect.set(player.UserId, now);
	const coins = coinsValue(player);
	if (coins !== undefined) {
		coins.Value += COLLECT_VALUE;
	}
	blob.Destroy();
}

const dropper = findWorldPart("Dropper");
const collector = findWorldPart("TycoonCollector");

if (dropper !== undefined) {
	task.spawn(() => {
		while (true) {
			task.wait(DROP_EVERY);
			const blob = new Instance("Part");
			blob.Name = "TycoonDrop";
			blob.Anchored = true;
			blob.Size = new Vector3(1, 1, 1);
			blob.Color = Color3.fromRGB(255, 200, 40);
			blob.Material = Enum.Material.Neon;
			blob.CFrame = dropper.CFrame.add(new Vector3(0, 2, 4));
			blob.Parent = dropper.Parent;

			blob.Touched.Connect((hit) => {
				if (blob.Parent === undefined) {
					return;
				}
				const character = hit.Parent;
				if (character === undefined) {
					return;
				}
				const player = Players.GetPlayerFromCharacter(character);
				if (player !== undefined) {
					tryCollect(player, blob);
				}
			});

			const start = blob.Position;
			const goal =
				collector !== undefined
					? collector.Position.add(new Vector3(0, 2, 0))
					: start.add(new Vector3(0, 0, 8));
			for (let step = 1; step <= MOVE_STEPS; step++) {
				if (blob.Parent === undefined) {
					break;
				}
				blob.Position = start.Lerp(goal, step / MOVE_STEPS);
				task.wait(MOVE_STEP_WAIT);
			}

			task.delay(8, () => {
				if (blob.Parent !== undefined) {
					blob.Destroy();
				}
			});
		}
	});
}

Players.PlayerRemoving.Connect((player) => {
	lastCollect.delete(player.UserId);
});
