/**
 * REFERENCE ONLY — copy into src/server/ for a one-shot NPC quest.
 * Not compiled from docs/examples.
 *
 * ProximityPrompt on QuestNpc → player must touch QuestGoal → coins once.
 */
import { Players, Workspace } from "@rbxts/services";

const REWARD = 10;
const accepted = new Set<number>();
const completed = new Set<number>();

function findWorldPart(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const part = world.FindFirstChild(name);
	return part !== undefined && part.IsA("BasePart") ? part : undefined;
}

function coinsValue(player: Player): IntValue | undefined {
	const stats = player.FindFirstChild("leaderstats");
	const coins = stats?.FindFirstChild("Coins");
	return coins !== undefined && coins.IsA("IntValue") ? coins : undefined;
}

const npc = findWorldPart("QuestNpc");
if (npc !== undefined) {
	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = "Accept quest";
	prompt.ObjectText = "Guide";
	prompt.HoldDuration = 0;
	prompt.MaxActivationDistance = 12;
	prompt.RequiresLineOfSight = false;
	prompt.Parent = npc;

	prompt.Triggered.Connect((player) => {
		if (completed.has(player.UserId)) {
			return;
		}
		accepted.add(player.UserId);
		print(`${player.Name} accepted: touch QuestGoal`);
	});
}

const goal = findWorldPart("QuestGoal");
if (goal !== undefined) {
	goal.Touched.Connect((hit) => {
		const character = hit.Parent;
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player === undefined) {
			return;
		}
		if (!accepted.has(player.UserId) || completed.has(player.UserId)) {
			return;
		}
		completed.add(player.UserId);
		const coins = coinsValue(player);
		if (coins !== undefined) {
			coins.Value += REWARD;
		}
		print(`${player.Name} completed the quest`);
	});
}

Players.PlayerRemoving.Connect((player) => {
	accepted.delete(player.UserId);
	completed.delete(player.UserId);
});
