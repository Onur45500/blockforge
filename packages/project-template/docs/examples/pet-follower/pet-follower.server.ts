/**
 * REFERENCE ONLY — copy into src/server/ for an anchored pet follower.
 * Not compiled from docs/examples.
 *
 * Touch PetGrantPad → clone PetMarker behind HRP each Heartbeat (server).
 * Pet stays Anchored. Not a trading/hatch system.
 */
import { Players, RunService, Workspace } from "@rbxts/services";

const OFFSET = new CFrame(0, 2, 5);
const pets = new Map<number, BasePart>();

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

function grantPet(player: Player): void {
	if (pets.has(player.UserId)) {
		return;
	}
	const template = findWorldPart("PetMarker");
	if (template === undefined) {
		return;
	}
	const clone = template.Clone();
	clone.Name = `${player.Name}Pet`;
	clone.Anchored = true;
	clone.CanCollide = false;
	clone.Parent = Workspace.FindFirstChild("World") ?? Workspace;
	pets.set(player.UserId, clone);
}

function findGrantPad(): BasePart | undefined {
	return findWorldPart("PetGrantPad");
}

const pad = findGrantPad();
if (pad !== undefined) {
	pad.Touched.Connect((hit) => {
		const character = hit.Parent;
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player !== undefined) {
			grantPet(player);
		}
	});
}

RunService.Heartbeat.Connect(() => {
	for (const [userId, pet] of pets) {
		if (pet.Parent === undefined) {
			pets.delete(userId);
			continue;
		}
		const player = Players.GetPlayerByUserId(userId);
		const character = player?.Character;
		const root = character?.FindFirstChild("HumanoidRootPart");
		if (root === undefined || !root.IsA("BasePart")) {
			continue;
		}
		pet.PivotTo(root.CFrame.mul(OFFSET));
	}
});

Players.PlayerRemoving.Connect((player) => {
	const pet = pets.get(player.UserId);
	if (pet !== undefined) {
		pet.Destroy();
		pets.delete(player.UserId);
	}
});
