/**
 * REFERENCE ONLY — optional client FX when a teleport happens.
 * Prefer server-authoritative CFrame moves (see teleport.server.ts).
 * Create Remotes/PlayerTeleported on the server, then FireClient after moving.
 *
 * See docs/REMOTE_EVENTS.md for the full remote checklist.
 */
import { ReplicatedStorage } from "@rbxts/services";

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const playerTeleported = remotes.WaitForChild("PlayerTeleported") as RemoteEvent;

playerTeleported.OnClientEvent.Connect(() => {
	// flash screen / play sound — visuals only, no gameplay authority
	print("Teleported (client FX)");
});
