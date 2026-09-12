/**
 * REFERENCE ONLY — copy into src/server/ when implementing coins + save.
 * Not compiled from docs/examples.
 *
 * Copy docs/examples/_shared/ensure-remotes.ts into src/shared/ensure-remotes.ts first.
 * Expects an anchored Part named CoinPad under Workspace.World.
 * Enable Studio API Services (DataStore) to test persistence in Play Solo with care.
 */
import { DataStoreService, Players, Workspace } from "@rbxts/services";
import { ensureRemoteEvent } from "shared/ensure-remotes";

const DATASTORE_NAME = "BlockforgePlayerCoins_v1";
const COIN_PAD_REWARD = 5;
const TOUCH_DEBOUNCE = 1.5;
const SAVE_DEBOUNCE = 8;
const ITEM_COST = 25;
const SHOP_TOOL_NAME = "ShopGadget";

const store = DataStoreService.GetDataStore(DATASTORE_NAME);
const lastTouch = new Map<number, number>();
const lastSave = new Map<number, number>();

function getCoinsValue(player: Player): IntValue | undefined {
	const stats = player.FindFirstChild("leaderstats");
	if (stats === undefined) {
		return undefined;
	}
	const coins = stats.FindFirstChild("Coins");
	return coins !== undefined && coins.IsA("IntValue") ? coins : undefined;
}

function ensureLeaderstats(player: Player): IntValue {
	let stats = player.FindFirstChild("leaderstats");
	if (stats === undefined) {
		stats = new Instance("Folder");
		stats.Name = "leaderstats";
		stats.Parent = player;
	}
	let coins = stats.FindFirstChild("Coins");
	if (coins === undefined || !coins.IsA("IntValue")) {
		coins = new Instance("IntValue");
		coins.Name = "Coins";
		coins.Value = 0;
		coins.Parent = stats;
	}
	return coins;
}

function rebirthMultiplier(player: Player): number {
	const value = player.FindFirstChild("RebirthMultiplier");
	if (value !== undefined && value.IsA("IntValue")) {
		return math.max(1, value.Value);
	}
	return 1;
}

function loadCoins(player: Player): void {
	const coins = ensureLeaderstats(player);
	const [ok, data] = pcall(() => store.GetAsync(`player_${player.UserId}`));
	if (ok && typeIs(data, "number")) {
		coins.Value = math.max(0, math.floor(data));
	}
}

function saveCoins(player: Player, force = false): void {
	const coins = getCoinsValue(player);
	if (coins === undefined) {
		return;
	}
	const now = os.clock();
	const previous = lastSave.get(player.UserId);
	if (!force && previous !== undefined && now - previous < SAVE_DEBOUNCE) {
		return;
	}
	lastSave.set(player.UserId, now);
	pcall(() => store.SetAsync(`player_${player.UserId}`, coins.Value));
}

function findCoinPad(): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const pad = world.FindFirstChild("CoinPad");
	return pad !== undefined && pad.IsA("BasePart") ? pad : undefined;
}

function grantShopGadget(player: Player): void {
	let owned = player.FindFirstChild("OwnedShopItem");
	if (owned === undefined || !owned.IsA("BoolValue")) {
		owned = new Instance("BoolValue");
		owned.Name = "OwnedShopItem";
		owned.Parent = player;
	}
	owned.Value = true;

	const backpack = player.FindFirstChild("Backpack");
	if (backpack === undefined || backpack.FindFirstChild(SHOP_TOOL_NAME) !== undefined) {
		return;
	}
	const character = player.Character;
	if (character !== undefined && character.FindFirstChild(SHOP_TOOL_NAME) !== undefined) {
		return;
	}

	const tool = new Instance("Tool");
	tool.Name = SHOP_TOOL_NAME;
	tool.RequiresHandle = true;
	const handle = new Instance("Part");
	handle.Name = "Handle";
	handle.Size = new Vector3(1, 1, 1);
	handle.Color = Color3.fromRGB(80, 180, 255);
	handle.Material = Enum.Material.Neon;
	handle.Parent = tool;
	tool.Parent = backpack;
}

Players.PlayerAdded.Connect((player) => {
	loadCoins(player);
});

Players.PlayerRemoving.Connect((player) => {
	saveCoins(player, true);
	lastTouch.delete(player.UserId);
	lastSave.delete(player.UserId);
});

game.BindToClose(() => {
	for (const player of Players.GetPlayers()) {
		saveCoins(player, true);
	}
});

for (const player of Players.GetPlayers()) {
	loadCoins(player);
}

const pad = findCoinPad();
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
		const coins = ensureLeaderstats(player);
		coins.Value += COIN_PAD_REWARD * rebirthMultiplier(player);
		saveCoins(player);
	});
}

const buyItem = ensureRemoteEvent("BuyItem");

buyItem.OnServerEvent.Connect((player) => {
	const coins = getCoinsValue(player);
	if (coins === undefined || coins.Value < ITEM_COST) {
		return;
	}
	coins.Value -= ITEM_COST;
	saveCoins(player, true);
	grantShopGadget(player);
});
