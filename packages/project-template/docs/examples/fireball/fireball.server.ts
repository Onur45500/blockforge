/**
 * REFERENCE ONLY — copy into src/server/ for an R-key fireball.
 * Not compiled from docs/examples.
 *
 * Copy docs/examples/_shared/ensure-remotes.ts into src/shared/ first.
 * Visual = small core + ParticleEmitter — never a lone Neon Ball.
 */
// blockforge:dynamic-parts — Fireball projectiles are runtime Parts, not scenery.
import { Players, Workspace } from "@rbxts/services";
import { ensureRemoteEvent } from "shared/ensure-remotes";

const SPEED = 90;
const DAMAGE = 12;
const LIFETIME = 4;
const CAST_COOLDOWN = 0.5;
const lastCast = new Map<number, number>();

const castFireball = ensureRemoteEvent("CastFireball");

function attachFlames(core: BasePart): void {
	const attachment = new Instance("Attachment");
	attachment.Name = "FlameAttach";
	attachment.Parent = core;

	const emitter = new Instance("ParticleEmitter");
	emitter.Name = "Flames";
	emitter.Texture = "rbxasset://textures/particles/fire_main.dds";
	emitter.Color = new ColorSequence(
		Color3.fromRGB(255, 160, 40),
		Color3.fromRGB(220, 40, 20),
	);
	emitter.Size = new NumberSequence(1.2, 0.2);
	emitter.Transparency = new NumberSequence(0.2, 1);
	emitter.Lifetime = NumberRange.new(0.25, 0.5);
	emitter.Rate = 40;
	emitter.Speed = NumberRange.new(2, 6);
	emitter.SpreadAngle = new Vector2(25, 25);
	emitter.LightEmission = 0.7;
	emitter.Parent = attachment;
}

function launchFireball(player: Player): void {
	const now = os.clock();
	const previous = lastCast.get(player.UserId);
	if (previous !== undefined && now - previous < CAST_COOLDOWN) {
		return;
	}
	lastCast.set(player.UserId, now);

	const character = player.Character;
	if (character === undefined) {
		return;
	}
	const root = character.FindFirstChild("HumanoidRootPart");
	if (root === undefined || !root.IsA("BasePart")) {
		return;
	}

	const look = root.CFrame.LookVector;
	const core = new Instance("Part");
	core.Name = "Fireball";
	core.Shape = Enum.PartType.Ball;
	core.Size = new Vector3(1.2, 1.2, 1.2);
	core.Color = Color3.fromRGB(40, 20, 10);
	core.Material = Enum.Material.SmoothPlastic;
	core.Anchored = false;
	core.CanCollide = false;
	core.CFrame = root.CFrame.add(look.mul(4));
	core.Parent = Workspace;
	attachFlames(core);

	core.AssemblyLinearVelocity = look.mul(SPEED);

	const hitPlayers = new Set<number>();
	core.Touched.Connect((hit) => {
		const model = hit.Parent;
		if (model === undefined || !model.IsA("Model")) {
			return;
		}
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid === undefined) {
			return;
		}
		const victim = Players.GetPlayerFromCharacter(model);
		if (victim !== undefined) {
			if (victim === player || hitPlayers.has(victim.UserId)) {
				return;
			}
			hitPlayers.add(victim.UserId);
		}
		humanoid.TakeDamage(DAMAGE);
		core.Destroy();
	});

	task.delay(LIFETIME, () => {
		if (core.Parent !== undefined) {
			core.Destroy();
		}
	});
}

castFireball.OnServerEvent.Connect((player) => {
	launchFireball(player);
});

Players.PlayerRemoving.Connect((player) => {
	lastCast.delete(player.UserId);
});
