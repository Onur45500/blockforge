/**
 * REFERENCE ONLY — copy into src/server/ to burst particles on touch.
 * Not compiled from docs/examples.
 *
 * Expects Workspace.World.VfxPad with a child ParticleEmitter (see VfxPad.model.json).
 */
import { Players, Workspace } from "@rbxts/services";

const BURST_COUNT = 24;
const TOUCH_DEBOUNCE = 1;

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

const pad = findWorldPart("VfxPad");
if (pad !== undefined) {
	const emitter = pad.FindFirstChildWhichIsA("ParticleEmitter", true);
	const lastTouch = new Map<number, number>();

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
		if (emitter !== undefined) {
			emitter.Emit(BURST_COUNT);
		}
	});
}
