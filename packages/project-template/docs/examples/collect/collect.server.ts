/**
 * REFERENCE ONLY — copy into src/server/ for click-to-collect.
 * Not compiled from docs/examples.
 *
 * Expects an anchored Part named CollectPad under Workspace.World.
 * ClickDetector is created in TypeScript.
 */
import { Players, Workspace } from "@rbxts/services";

const REWARD = 1;
const CLICK_DEBOUNCE = 0.4;
const lastClick = new Map<number, number>();

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
	if (stats === undefined) {
		return undefined;
	}
	const coins = stats.FindFirstChild("Coins");
	return coins !== undefined && coins.IsA("IntValue") ? coins : undefined;
}

const pad = findWorldPart("CollectPad");
if (pad !== undefined) {
	const click = new Instance("ClickDetector");
	click.MaxActivationDistance = 16;
	click.Parent = pad;

	click.MouseClick.Connect((player: Player) => {
		const now = os.clock();
		const previous = lastClick.get(player.UserId);
		if (previous !== undefined && now - previous < CLICK_DEBOUNCE) {
			return;
		}
		lastClick.set(player.UserId, now);
		const coins = coinsValue(player);
		if (coins !== undefined) {
			coins.Value += REWARD;
		}
	});
}

Players.PlayerRemoving.Connect((player) => {
	lastClick.delete(player.UserId);
});
