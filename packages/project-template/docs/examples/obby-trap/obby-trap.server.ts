/**
 * REFERENCE ONLY — copy into src/server/ for a fading floor + lava kill.
 * Not compiled from docs/examples.
 *
 * FadeTrap: server tween Transparency, then CanCollide false, then restore.
 * LavaBrick: anchored .Touched sets Humanoid.Health = 0 (not a client kill).
 * Instant KillBrick teleport is docs/examples/obby-logic/ — this is the lava/fade pair.
 */
import { Players, TweenService, Workspace } from "@rbxts/services";

const SOLID_SECONDS = 3;
const FADE_SECONDS = 1.2;
const GONE_SECONDS = 2;
const LAVA_DEBOUNCE = 1;
const lastLava = new Map<number, number>();

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

function characterFromHit(hit: BasePart): Model | undefined {
	const parent = hit.Parent;
	return parent !== undefined && parent.IsA("Model") ? parent : undefined;
}

const fadeTrap = findWorldPart("FadeTrap");
if (fadeTrap !== undefined) {
	task.spawn(() => {
		while (true) {
			fadeTrap.Transparency = 0;
			fadeTrap.CanCollide = true;
			task.wait(SOLID_SECONDS);

			const fade = TweenService.Create(fadeTrap, new TweenInfo(FADE_SECONDS, Enum.EasingStyle.Linear), {
				Transparency: 1,
			});
			fade.Play();
			fade.Completed.Wait();
			fadeTrap.CanCollide = false;
			task.wait(GONE_SECONDS);
		}
	});
}

const lava = findWorldPart("LavaBrick");
if (lava !== undefined) {
	lava.Touched.Connect((hit) => {
		const character = characterFromHit(hit);
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player === undefined) {
			return;
		}
		const now = os.clock();
		const previous = lastLava.get(player.UserId);
		if (previous !== undefined && now - previous < LAVA_DEBOUNCE) {
			return;
		}
		lastLava.set(player.UserId, now);
		const humanoid = character.FindFirstChildWhichIsA("Humanoid");
		if (humanoid !== undefined) {
			humanoid.Health = 0;
		}
	});
}

Players.PlayerRemoving.Connect((player) => {
	lastLava.delete(player.UserId);
});
