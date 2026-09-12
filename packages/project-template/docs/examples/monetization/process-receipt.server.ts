/**
 * REFERENCE ONLY — copy into src/server/ after creating products in Blockforge Monetization.
 * Not compiled from docs/examples.
 *
 * Grant on the server from ProcessReceipt. Never FireServer a "I paid" flag from the client.
 * Copy product ids from monetization.json (live ids, not local-* placeholders).
 */
import { DataStoreService, MarketplaceService, Players } from "@rbxts/services";

const RECEIPT_STORE = DataStoreService.GetDataStore("BlockforgeReceipts_v1");

/** Replace with ids from monetization.json once Open Cloud created them. */
const PRODUCT_COINS: Record<number, number> = {
	// 123456789: 100,
};

function addCoins(player: Player, amount: number): void {
	const stats = player.FindFirstChild("leaderstats");
	const coins = stats?.FindFirstChild("Coins");
	if (coins !== undefined && coins.IsA("IntValue")) {
		coins.Value += amount;
	}
}

MarketplaceService.ProcessReceipt = (info: ReceiptInfo) => {
	const key = `receipt_${info.PurchaseId}`;
	const [ok, already] = pcall(() => RECEIPT_STORE.GetAsync(key));
	if (ok && already === true) {
		return Enum.ProductPurchaseDecision.PurchaseGranted;
	}

	const player = Players.GetPlayerByUserId(info.PlayerId);
	if (player === undefined) {
		return Enum.ProductPurchaseDecision.NotProcessedYet;
	}

	const coins = PRODUCT_COINS[info.ProductId];
	if (coins === undefined) {
		return Enum.ProductPurchaseDecision.NotProcessedYet;
	}

	addCoins(player, coins);

	const [saved] = pcall(() => RECEIPT_STORE.SetAsync(key, true));
	if (!saved) {
		return Enum.ProductPurchaseDecision.NotProcessedYet;
	}
	return Enum.ProductPurchaseDecision.PurchaseGranted;
};
