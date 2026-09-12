/**
 * REFERENCE ONLY — copy into src/client/. Prompts the Game Pass purchase UI only.
 * Server grants the speed perk after Marketplace confirms ownership.
 */
import { MarketplaceService, Players, ReplicatedStorage } from "@rbxts/services";

/** Must match gamepass.server.ts. 0 = skip prompt. */
const GAME_PASS_ID = 0;

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const promptPass = remotes.WaitForChild("PromptSpeedPass") as RemoteEvent;

promptPass.OnClientEvent.Connect(() => {
	if (GAME_PASS_ID <= 0) {
		print("Game pass example: set GAME_PASS_ID to a live id from monetization.json");
		return;
	}
	MarketplaceService.PromptGamePassPurchase(Players.LocalPlayer, GAME_PASS_ID);
});
