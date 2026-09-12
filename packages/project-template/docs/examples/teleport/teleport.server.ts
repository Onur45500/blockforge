/**
 * REFERENCE ONLY — copy into src/server/ when implementing teleport pads.
 * Not compiled from docs/examples.
 *
 * Copy docs/examples/_shared/ensure-remotes.ts into src/shared/ensure-remotes.ts first.
 * Expects Parts named TeleportPadA and TeleportPadB under Workspace.World.
 * After moving, fires Remotes/PlayerTeleported for optional client FX.
 */
import { Players, Workspace } from "@rbxts/services";
import { ensureRemoteEvent } from "shared/ensure-remotes";

const DEBOUNCE_SECONDS = 1.5;
const lastTeleport = new Map<number, number>();
const playerTeleported = ensureRemoteEvent("PlayerTeleported");

function findPad(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const pad = world.FindFirstChild(name);
	return pad !== undefined && pad.IsA("BasePart") ? pad : undefined;
}

function teleportPlayer(player: Player, destination: BasePart): void {
	const character = player.Character;
	if (character === undefined) {
		return;
	}
	const root = character.FindFirstChild("HumanoidRootPart");
	if (root === undefined || !root.IsA("BasePart")) {
		return;
	}
	const now = os.clock();
	const previous = lastTeleport.get(player.UserId);
	if (previous !== undefined && now - previous < DEBOUNCE_SECONDS) {
		return;
	}
	lastTeleport.set(player.UserId, now);
	root.CFrame = destination.CFrame.add(new Vector3(0, 3, 0));
	playerTeleported.FireClient(player);
}

const padA = findPad("TeleportPadA");
const padB = findPad("TeleportPadB");

if (padA !== undefined && padB !== undefined) {
	padA.Touched.Connect((hit) => {
		const character = hit.Parent;
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player !== undefined) {
			teleportPlayer(player, padB);
		}
	});

	padB.Touched.Connect((hit) => {
		const character = hit.Parent;
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player !== undefined) {
			teleportPlayer(player, padA);
		}
	});
}

Players.PlayerRemoving.Connect((player) => {
	lastTeleport.delete(player.UserId);
});
