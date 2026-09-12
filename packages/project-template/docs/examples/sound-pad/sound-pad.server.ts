/**
 * REFERENCE ONLY — copy into src/server/ for a touch sound pad.
 * Not compiled from docs/examples.
 *
 * Plays a Sound parented to SoundPad. SoundId must come from shared/assets
 * (imported audio). Never invent rbxassetid://. Skips play if ASSETS is empty.
 */
import { Players, Workspace } from "@rbxts/services";
import { ASSETS, type AssetKey } from "shared/assets";

const TOUCH_DEBOUNCE = 0.8;
const lastPlay = new Map<number, number>();

function findPad(): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const pad = world.FindFirstChild("SoundPad");
	return pad !== undefined && pad.IsA("BasePart") ? pad : undefined;
}

function firstAssetId(): string | undefined {
	for (const [key] of pairs(ASSETS)) {
		return ASSETS[key as AssetKey];
	}
	return undefined;
}

const pad = findPad();
if (pad !== undefined) {
	const sound = new Instance("Sound");
	sound.Name = "PadSound";
	sound.Volume = 0.6;
	const assetId = firstAssetId();
	if (assetId !== undefined) {
		sound.SoundId = assetId;
	}
	sound.Parent = pad;

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
		const previous = lastPlay.get(player.UserId);
		if (previous !== undefined && now - previous < TOUCH_DEBOUNCE) {
			return;
		}
		lastPlay.set(player.UserId, now);
		if (sound.SoundId.size() === 0) {
			print("sound-pad: import an audio clip in Blockforge Assets, then copy the key from shared/assets.ts");
			return;
		}
		sound.Play();
	});
}

Players.PlayerRemoving.Connect((player) => {
	lastPlay.delete(player.UserId);
});
