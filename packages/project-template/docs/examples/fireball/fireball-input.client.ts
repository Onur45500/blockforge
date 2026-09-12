/**
 * REFERENCE ONLY — copy into src/client/ for R-key fireball input.
 * Not compiled from docs/examples.
 *
 * Requires Remotes/CastFireball created on the server (fireball.server.ts).
 */
import { ReplicatedStorage, UserInputService } from "@rbxts/services";

const remotes = ReplicatedStorage.WaitForChild("Remotes");
const castFireball = remotes.WaitForChild("CastFireball") as RemoteEvent;

let lastCast = 0;
const CAST_COOLDOWN = 0.5;

UserInputService.InputBegan.Connect((input, gameProcessed) => {
	if (gameProcessed) {
		return;
	}
	if (input.KeyCode !== Enum.KeyCode.R) {
		return;
	}
	const now = os.clock();
	if (now - lastCast < CAST_COOLDOWN) {
		return;
	}
	lastCast = now;
	castFireball.FireServer();
});
