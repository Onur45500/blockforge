/**
 * REFERENCE ONLY — copy into src/server/ for a server-raycast tool.
 * Not compiled from docs/examples.
 *
 * Expects Part named RaycastRack under Workspace.World.
 * Activated → Workspace.Raycast from HRP look. Never trust a client hit list.
 */
import { Players, ReplicatedStorage, Workspace } from "@rbxts/services";

const TOOL_NAME = "RaycastBlaster";
const DAMAGE = 15;
const RANGE = 48;
const ACTIVATE_COOLDOWN = 0.45;
const lastShot = new Map<number, number>();

function createTool(): Tool {
	const existing = ReplicatedStorage.FindFirstChild(TOOL_NAME);
	if (existing !== undefined && existing.IsA("Tool")) {
		return existing;
	}
	const tool = new Instance("Tool");
	tool.Name = TOOL_NAME;
	tool.RequiresHandle = true;
	const handle = new Instance("Part");
	handle.Name = "Handle";
	handle.Size = new Vector3(0.6, 0.6, 3);
	handle.Color = Color3.fromRGB(180, 40, 40);
	handle.Material = Enum.Material.Metal;
	handle.Parent = tool;
	tool.Parent = ReplicatedStorage;
	return tool;
}

function sameTeam(a: Player, b: Player): boolean {
	return a.Team !== undefined && b.Team !== undefined && a.Team === b.Team;
}

function giveTool(player: Player): void {
	const backpack = player.FindFirstChild("Backpack");
	if (backpack === undefined || backpack.FindFirstChild(TOOL_NAME) !== undefined) {
		return;
	}
	const character = player.Character;
	if (character !== undefined && character.FindFirstChild(TOOL_NAME) !== undefined) {
		return;
	}

	const clone = createTool().Clone();
	clone.Parent = backpack;

	clone.Activated.Connect(() => {
		const now = os.clock();
		const previous = lastShot.get(player.UserId);
		if (previous !== undefined && now - previous < ACTIVATE_COOLDOWN) {
			return;
		}
		lastShot.set(player.UserId, now);

		const char = player.Character;
		if (char === undefined) {
			return;
		}
		const root = char.FindFirstChild("HumanoidRootPart");
		if (root === undefined || !root.IsA("BasePart")) {
			return;
		}

		const params = new RaycastParams();
		params.FilterType = Enum.RaycastFilterType.Exclude;
		params.FilterDescendantsInstances = [char];
		const result = Workspace.Raycast(root.Position, root.CFrame.LookVector.mul(RANGE), params);
		if (result === undefined) {
			return;
		}
		const model = result.Instance.FindFirstAncestorOfClass("Model");
		if (model === undefined) {
			return;
		}
		const humanoid = model.FindFirstChildOfClass("Humanoid");
		if (humanoid === undefined) {
			return;
		}
		const victim = Players.GetPlayerFromCharacter(model);
		if (victim !== undefined && sameTeam(player, victim)) {
			return;
		}
		humanoid.TakeDamage(DAMAGE);
	});
}

function findRack(): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const rack = world.FindFirstChild("RaycastRack");
	return rack !== undefined && rack.IsA("BasePart") ? rack : undefined;
}

createTool();

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
	lastShot.delete(player.UserId);
});
