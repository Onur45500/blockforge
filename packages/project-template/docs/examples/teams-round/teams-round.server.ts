/**
 * REFERENCE ONLY — copy into src/server/ for a two-team timed round.
 * Not compiled from docs/examples.
 *
 * Expects TeamPadRed and TeamPadBlue under Workspace.World (not extra SpawnLocations).
 * Scores: leaderstats/Points. Do not add a second enabled SpawnLocation.
 */
import { Players, Teams, Workspace } from "@rbxts/services";

const ROUND_SECONDS = 60;
const INTERMISSION_SECONDS = 10;

function ensureTeam(name: string, color: BrickColor): Team {
	const existing = Teams.FindFirstChild(name);
	if (existing !== undefined && existing.IsA("Team")) {
		return existing;
	}
	const team = new Instance("Team");
	team.Name = name;
	team.TeamColor = color;
	team.AutoAssignable = false;
	team.Parent = Teams;
	return team;
}

const red = ensureTeam("Red", new BrickColor("Really red"));
const blue = ensureTeam("Blue", new BrickColor("Really blue"));

function ensurePoints(player: Player): IntValue {
	let stats = player.FindFirstChild("leaderstats");
	if (stats === undefined) {
		stats = new Instance("Folder");
		stats.Name = "leaderstats";
		stats.Parent = player;
	}
	const existing = stats.FindFirstChild("Points");
	if (existing !== undefined && existing.IsA("IntValue")) {
		return existing;
	}
	const points = new Instance("IntValue");
	points.Name = "Points";
	points.Value = 0;
	points.Parent = stats;
	return points;
}

function findPad(name: string): BasePart | undefined {
	const world = Workspace.FindFirstChild("World");
	if (world === undefined) {
		return undefined;
	}
	const pad = world.FindFirstChild(name);
	return pad !== undefined && pad.IsA("BasePart") ? pad : undefined;
}

function teleportToPad(player: Player, pad: BasePart): void {
	const character = player.Character;
	if (character === undefined) {
		return;
	}
	const root = character.FindFirstChild("HumanoidRootPart");
	if (root !== undefined && root.IsA("BasePart")) {
		root.CFrame = pad.CFrame.add(new Vector3(0, 3, 0));
	}
}

function assignTeams(): void {
	const list = Players.GetPlayers();
	for (let i = 0; i < list.size(); i++) {
		const player = list[i];
		if (player === undefined) {
			continue;
		}
		player.Team = i % 2 === 0 ? red : blue;
		ensurePoints(player);
	}
}

function spawnTeams(): void {
	const redPad = findPad("TeamPadRed");
	const bluePad = findPad("TeamPadBlue");
	for (const player of Players.GetPlayers()) {
		if (player.Team === red && redPad !== undefined) {
			teleportToPad(player, redPad);
		} else if (player.Team === blue && bluePad !== undefined) {
			teleportToPad(player, bluePad);
		}
	}
}

function awardSurvival(): void {
	for (const player of Players.GetPlayers()) {
		if (player.Team === red || player.Team === blue) {
			ensurePoints(player).Value += 1;
		}
	}
}

Players.PlayerAdded.Connect((player) => {
	ensurePoints(player);
});

for (const player of Players.GetPlayers()) {
	ensurePoints(player);
}

task.spawn(() => {
	while (true) {
		assignTeams();
		spawnTeams();
		print(`Round start (${ROUND_SECONDS}s)`);
		task.wait(ROUND_SECONDS);
		awardSurvival();
		print(`Intermission (${INTERMISSION_SECONDS}s)`);
		task.wait(INTERMISSION_SECONDS);
	}
});
