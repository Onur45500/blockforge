/**
 * REFERENCE ONLY — copy into src/server/ after creating a live Game Pass id.
 * Not compiled from docs/examples.
 *
 * Copy docs/examples/_shared/ensure-remotes.ts into src/shared/ensure-remotes.ts first.
 * Client only prompts. Server checks UserOwnsGamePassAsync and applies WalkSpeed.
 * Set GAME_PASS_ID to 0 to skip live Marketplace calls in Studio.
 */
import { MarketplaceService, Players, Workspace } from "@rbxts/services";
import { ensureRemoteEvent } from "shared/ensure-remotes";

/** Live Open Cloud game pass id. 0 = no-op (do not invent an id). */
const GAME_PASS_ID = 0;
const VIP_WALKSPEED = 24;
const DEFAULT_WALKSPEED = 16;

const promptPass = ensureRemoteEvent("PromptSpeedPass");

function applySpeed(player: Player, vip: boolean): void {
	const character = player.Character;
	if (character === undefined) {
		return;
	}
	const humanoid = character.FindFirstChildOfClass("Humanoid");
	if (humanoid !== undefined) {
		humanoid.WalkSpeed = vip ? VIP_WALKSPEED : DEFAULT_WALKSPEED;
	}
}

function refreshPass(player: Player): void {
	if (GAME_PASS_ID <= 0) {
		return;
	}
	const [ok, owns] = pcall(() => MarketplaceService.UserOwnsGamePassAsync(player.UserId, GAME_PASS_ID));
	applySpeed(player, ok && owns === true);
}

Players.PlayerAdded.Connect((player) => {
	player.CharacterAdded.Connect(() => {
		refreshPass(player);
	});
	refreshPass(player);
});

for (const player of Players.GetPlayers()) {
	refreshPass(player);
}

MarketplaceService.PromptGamePassPurchaseFinished.Connect((player, passId, purchased) => {
	if (passId === GAME_PASS_ID && purchased) {
		applySpeed(player, true);
	}
});

function findPad(): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const pad = world.FindFirstChild("GamePassPad");
	return pad !== undefined && pad.IsA("BasePart") ? pad : undefined;
}

const pad = findPad();
if (pad !== undefined) {
	pad.Touched.Connect((hit) => {
		const character = hit.Parent;
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player !== undefined) {
			promptPass.FireClient(player);
		}
	});
}
