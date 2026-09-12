/**
 * REFERENCE ONLY — copy into src/server/ for a weighted roll pad.
 * Not compiled from docs/examples.
 *
 * Copy docs/examples/_shared/ensure-remotes.ts into src/shared/ensure-remotes.ts first.
 * Expects Collect-style Part named RollPad under Workspace.World.
 * Client may FireServer on Remotes/Roll with NO rarity argument.
 */
import { Players, Workspace } from "@rbxts/services";
import { ensureRemoteEvent } from "shared/ensure-remotes";

const TOUCH_DEBOUNCE = 0.8;
const PITY_AFTER = 10;
const lastRoll = new Map<number, number>();
const pity = new Map<number, number>();

type Tier = "Common" | "Uncommon" | "Rare";

function coinsValue(player: Player): IntValue | undefined {
	const stats = player.FindFirstChild("leaderstats");
	const coins = stats?.FindFirstChild("Coins");
	return coins !== undefined && coins.IsA("IntValue") ? coins : undefined;
}

function rollTier(userId: number): Tier {
	const streak = pity.get(userId) ?? 0;
	if (streak >= PITY_AFTER) {
		pity.set(userId, 0);
		return "Rare";
	}
	const n = math.random() * 100;
	if (n < 70) {
		pity.set(userId, streak + 1);
		return "Common";
	}
	if (n < 94) {
		pity.set(userId, streak + 1);
		return "Uncommon";
	}
	pity.set(userId, 0);
	return "Rare";
}

function grant(tier: Tier): number {
	if (tier === "Rare") {
		return 15;
	}
	if (tier === "Uncommon") {
		return 5;
	}
	return 1;
}

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

const rollRemote = ensureRemoteEvent("Roll");

function tryRoll(player: Player): void {
	const now = os.clock();
	const previous = lastRoll.get(player.UserId);
	if (previous !== undefined && now - previous < TOUCH_DEBOUNCE) {
		return;
	}
	lastRoll.set(player.UserId, now);
	const coins = coinsValue(player);
	if (coins === undefined) {
		return;
	}
	const tier = rollTier(player.UserId);
	coins.Value += grant(tier);
	print(`${player.Name} rolled ${tier}`);
}

rollRemote.OnServerEvent.Connect((player) => {
	tryRoll(player);
});

const pad = findWorldPart("RollPad");
if (pad !== undefined) {
	pad.Touched.Connect((hit) => {
		const character = hit.Parent;
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player !== undefined) {
			tryRoll(player);
		}
	});
}

Players.PlayerRemoving.Connect((player) => {
	lastRoll.delete(player.UserId);
	pity.delete(player.UserId);
});
