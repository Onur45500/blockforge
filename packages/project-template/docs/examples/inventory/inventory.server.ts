/**
 * REFERENCE ONLY — copy into src/server/ for a loot-pad inventory.
 * Not compiled from docs/examples.
 *
 * Expects an anchored Part named LootPad under Workspace.World.
 * Client HUD only reads player.Inventory — it cannot add items.
 */
import { Players, Workspace } from "@rbxts/services";

const ITEM_NAME = "Potion";
const TOUCH_DEBOUNCE = 1;
const lastLoot = new Map<number, number>();

function ensureInventory(player: Player): Folder {
	let folder = player.FindFirstChild("Inventory");
	if (folder === undefined || !folder.IsA("Folder")) {
		folder = new Instance("Folder");
		folder.Name = "Inventory";
		folder.Parent = player;
	}
	let potion = folder.FindFirstChild(ITEM_NAME);
	if (potion === undefined || !potion.IsA("IntValue")) {
		potion = new Instance("IntValue");
		potion.Name = ITEM_NAME;
		potion.Value = 0;
		potion.Parent = folder;
	}
	return folder;
}

function findLootPad(): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const pad = world.FindFirstChild("LootPad");
	return pad !== undefined && pad.IsA("BasePart") ? pad : undefined;
}

Players.PlayerAdded.Connect((player) => {
	ensureInventory(player);
});

for (const player of Players.GetPlayers()) {
	ensureInventory(player);
}

const pad = findLootPad();
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
		const previous = lastLoot.get(player.UserId);
		if (previous !== undefined && now - previous < TOUCH_DEBOUNCE) {
			return;
		}
		lastLoot.set(player.UserId, now);
		const folder = ensureInventory(player);
		const potion = folder.FindFirstChild(ITEM_NAME);
		if (potion !== undefined && potion.IsA("IntValue")) {
			potion.Value += 1;
		}
	});
}

Players.PlayerRemoving.Connect((player) => {
	lastLoot.delete(player.UserId);
});
