/**
 * REFERENCE ONLY — copy into src/server/ for a simple give-tool + activate MVP.
 * Not compiled from docs/examples.
 *
 * Creates ReplicatedStorage.SwordTool and clones it when the player touches WeaponRack
 * (or on PlayerAdded if you uncomment that path).
 */
import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";

const TOOL_NAME = "TrainingSword";
const DAMAGE = 10;
const ACTIVATE_COOLDOWN = 0.6;
const lastSwing = new Map<number, number>();

function createSwordTool(): Tool {
	const existing = ReplicatedStorage.FindFirstChild(TOOL_NAME);
	if (existing !== undefined && existing.IsA("Tool")) {
		return existing;
	}

	const tool = new Instance("Tool");
	tool.Name = TOOL_NAME;
	tool.RequiresHandle = true;

	const handle = new Instance("Part");
	handle.Name = "Handle";
	handle.Size = new Vector3(0.4, 4, 0.4);
	handle.Color = Color3.fromRGB(180, 180, 190);
	handle.Material = Enum.Material.Metal;
	handle.Parent = tool;

	tool.Parent = ReplicatedStorage;
	return tool;
}

function giveTool(player: Player): void {
	const backpack = player.FindFirstChild("Backpack");
	if (backpack === undefined) {
		return;
	}
	if (backpack.FindFirstChild(TOOL_NAME) !== undefined) {
		return;
	}
	const character = player.Character;
	if (character !== undefined && character.FindFirstChild(TOOL_NAME) !== undefined) {
		return;
	}

	const template = createSwordTool();
	const clone = template.Clone();
	clone.Parent = backpack;

	clone.Activated.Connect(() => {
		const now = os.clock();
		const previous = lastSwing.get(player.UserId);
		if (previous !== undefined && now - previous < ACTIVATE_COOLDOWN) {
			return;
		}
		lastSwing.set(player.UserId, now);

		const character = player.Character;
		if (character === undefined) {
			return;
		}
		const root = character.FindFirstChild("HumanoidRootPart");
		if (root === undefined || !root.IsA("BasePart")) {
			return;
		}

		// Simple forward hit: damage nearby humanoids (server-authoritative)
		for (const other of Players.GetPlayers()) {
			if (other === player) {
				continue;
			}
			const otherChar = other.Character;
			if (otherChar === undefined) {
				continue;
			}
			const otherRoot = otherChar.FindFirstChild("HumanoidRootPart");
			const humanoid = otherChar.FindFirstChildOfClass("Humanoid");
			if (otherRoot === undefined || !otherRoot.IsA("BasePart") || humanoid === undefined) {
				continue;
			}
			if (otherRoot.Position.sub(root.Position).Magnitude <= 8) {
				humanoid.TakeDamage(DAMAGE);
			}
		}
	});
}

function findRack(): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const rack = world.FindFirstChild("WeaponRack");
	return rack !== undefined && rack.IsA("BasePart") ? rack : undefined;
}

createSwordTool();

const rack = findRack();
if (rack !== undefined) {
	rack.Touched.Connect((hit) => {
		const character = hit.Parent;
		if (character === undefined) {
			return;
		}
		const player = Players.GetPlayerFromCharacter(character);
		if (player !== undefined) {
			giveTool(player);
		}
	});
}

Players.PlayerRemoving.Connect((player) => {
	lastSwing.delete(player.UserId);
});
