/**
 * REFERENCE ONLY — copy into src/server/admin.server.ts
 * Also copy admin-config.ts to src/shared/ and adjust the import path.
 * Chat commands: :speed [n] | :tp <playerName>
 * Allowlist only — see admin-config.ts. Do not vendor Adonis or exploit admins.
 */
import { Players } from "@rbxts/services";
import { isAdmin } from "../shared/admin-config";

function findPlayerByName(name: string): Player | undefined {
	const lower = string.lower(name);
	for (const player of Players.GetPlayers()) {
		if (string.lower(player.Name) === lower || string.lower(player.DisplayName) === lower) {
			return player;
		}
	}
	return undefined;
}

function handleCommand(player: Player, message: string): void {
	if (!isAdmin(player.UserId)) {
		return;
	}

	const trimmed = string.gsub(message, "^%s+", "")[0];
	if (string.sub(trimmed, 1, 1) !== ":") {
		return;
	}

	const parts = string.split(trimmed, " ");
	const command = string.lower(parts[0]);

	if (command === ":speed") {
		const value = parts.size() > 1 ? tonumber(parts[1]) : 16;
		const character = player.Character;
		const humanoid = character?.FindFirstChildOfClass("Humanoid");
		if (humanoid !== undefined && value !== undefined) {
			humanoid.WalkSpeed = math.clamp(value, 0, 100);
		}
		return;
	}

	if (command === ":tp" && parts.size() > 1) {
		const target = findPlayerByName(parts[1]);
		const root = player.Character?.FindFirstChild("HumanoidRootPart");
		const targetRoot = target?.Character?.FindFirstChild("HumanoidRootPart");
		if (
			target !== undefined &&
			root !== undefined &&
			root.IsA("BasePart") &&
			targetRoot !== undefined &&
			targetRoot.IsA("BasePart")
		) {
			root.CFrame = targetRoot.CFrame.add(new Vector3(0, 0, 5));
		}
	}
}

Players.PlayerAdded.Connect((player) => {
	player.Chatted.Connect((msg) => {
		handleCommand(player, msg);
	});
});

for (const player of Players.GetPlayers()) {
	player.Chatted.Connect((msg) => {
		handleCommand(player, msg);
	});
}
