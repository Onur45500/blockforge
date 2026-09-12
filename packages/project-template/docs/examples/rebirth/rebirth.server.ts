/**
 * REFERENCE ONLY — copy into src/server/ for a spend-coins rebirth multiplier.
 * Not compiled from docs/examples.
 *
 * Touch RebirthPad: if Coins >= COST, subtract COST and increment RebirthMultiplier.
 * CoinPad in leaderstats.server.ts already multiplies grants by that value.
 */
import { Players, Workspace } from "@rbxts/services";

const COST = 50;
const TOUCH_DEBOUNCE = 1.2;
const lastTouch = new Map<number, number>();

function coinsValue(player: Player): IntValue | undefined {
	const stats = player.FindFirstChild("leaderstats");
	const coins = stats?.FindFirstChild("Coins");
	return coins !== undefined && coins.IsA("IntValue") ? coins : undefined;
}

function ensureMultiplier(player: Player): IntValue {
	let value = player.FindFirstChild("RebirthMultiplier");
	if (value === undefined || !value.IsA("IntValue")) {
		value = new Instance("IntValue");
		value.Name = "RebirthMultiplier";
		value.Value = 1;
		value.Parent = player;
	}
	return value;
}

function findPad(): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const pad = world.FindFirstChild("RebirthPad");
	return pad !== undefined && pad.IsA("BasePart") ? pad : undefined;
}

Players.PlayerAdded.Connect((player) => {
	ensureMultiplier(player);
});

for (const player of Players.GetPlayers()) {
	ensureMultiplier(player);
}

const pad = findPad();
if (pad !== undefined) {
	pad.Touched.Connect((hit) => {
		const character = hit.Parent;
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player === undefined) {
			return;
		}
		const now = os.clock();
		const previous = lastTouch.get(player.UserId);
		if (previous !== undefined && now - previous < TOUCH_DEBOUNCE) {
			return;
		}
		lastTouch.set(player.UserId, now);

		const coins = coinsValue(player);
		if (coins === undefined || coins.Value < COST) {
			return;
		}
		coins.Value -= COST;
		ensureMultiplier(player).Value += 1;
	});
}

Players.PlayerRemoving.Connect((player) => {
	lastTouch.delete(player.UserId);
});
