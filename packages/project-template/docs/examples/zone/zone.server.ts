/**
 * REFERENCE ONLY — copy into src/server/ for a volume enter/leave zone.
 * Not compiled from docs/examples.
 *
 * Expects ZoneVolume under Workspace.World (CanCollide false).
 * Uses GetPartsInPart on an interval — not Touched (Touched misses stay-inside).
 * Do not vendor ZonePlus; this is the MVP shape.
 */
import { Players, Workspace } from "@rbxts/services";

const POLL_SECONDS = 0.2;
const INSIDE_WALK_SPEED = 24;
const DEFAULT_WALK_SPEED = 16;
const inside = new Set<number>();
const previousSpeed = new Map<number, number>();

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

function playersInVolume(zone: BasePart): Set<number> {
	const found = new Set<number>();
	const parts = Workspace.GetPartsInPart(zone);
	for (const part of parts) {
		if (part.Name !== "HumanoidRootPart") {
			continue;
		}
		const character = part.Parent;
		if (character === undefined) {
			continue;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player !== undefined) {
			found.add(player.UserId);
		}
	}
	return found;
}

function humanoidOf(player: Player): Humanoid | undefined {
	const character = player.Character;
	if (character === undefined) {
		return undefined;
	}
	const humanoid = character.FindFirstChildWhichIsA("Humanoid");
	return humanoid !== undefined ? humanoid : undefined;
}

function onEnter(player: Player): void {
	const humanoid = humanoidOf(player);
	if (humanoid !== undefined) {
		previousSpeed.set(player.UserId, humanoid.WalkSpeed);
		humanoid.WalkSpeed = INSIDE_WALK_SPEED;
	}
	player.SetAttribute("InZone", true);
	print(`${player.Name} entered ZoneVolume`);
}

function onLeave(player: Player): void {
	const humanoid = humanoidOf(player);
	if (humanoid !== undefined) {
		humanoid.WalkSpeed = previousSpeed.get(player.UserId) ?? DEFAULT_WALK_SPEED;
	}
	previousSpeed.delete(player.UserId);
	player.SetAttribute("InZone", false);
	print(`${player.Name} left ZoneVolume`);
}

const zone = findWorldPart("ZoneVolume");
if (zone !== undefined) {
	zone.CanCollide = false;
	task.spawn(() => {
		while (true) {
			const nowInside = playersInVolume(zone);
			for (const userId of nowInside) {
				if (!inside.has(userId)) {
					const player = Players.GetPlayerByUserId(userId);
					if (player !== undefined) {
						onEnter(player);
					}
				}
			}
			for (const userId of inside) {
				if (!nowInside.has(userId)) {
					const player = Players.GetPlayerByUserId(userId);
					if (player !== undefined) {
						onLeave(player);
					}
				}
			}
			inside.clear();
			for (const userId of nowInside) {
				inside.add(userId);
			}
			task.wait(POLL_SECONDS);
		}
	});
}

Players.PlayerRemoving.Connect((player) => {
	inside.delete(player.UserId);
	previousSpeed.delete(player.UserId);
});
