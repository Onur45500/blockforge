/**
 * REFERENCE ONLY — copy into src/server/ for a two-map timed arena.
 * Not compiled from docs/examples.
 *
 * Pads: MapA_Red / MapA_Blue / MapB_Red / MapB_Blue (not extra SpawnLocations).
 * Each round picks A or B, teleports teams, writes ReplicatedStorage.ArenaStatus.
 * Single-map MVP: docs/examples/teams-round/.
 */
import { Players, ReplicatedStorage, Teams, Workspace } from "@rbxts/services";

const ROUND_SECONDS = 45;
const INTERMISSION_SECONDS = 8;

type MapId = "A" | "B";

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

function ensureStatus(): StringValue {
	const existing = ReplicatedStorage.FindFirstChild("ArenaStatus");
	if (existing !== undefined && existing.IsA("StringValue")) {
		return existing;
	}
	const status = new Instance("StringValue");
	status.Name = "ArenaStatus";
	status.Value = "Waiting";
	status.Parent = ReplicatedStorage;
	return status;
}

const status = ensureStatus();

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

function pickMap(): MapId {
	return math.random() < 0.5 ? "A" : "B";
}

function spawnOnMap(mapId: MapId): void {
	const redPad = mapId === "A" ? findPad("MapA_Red") : findPad("MapB_Red");
	const bluePad = mapId === "A" ? findPad("MapA_Blue") : findPad("MapB_Blue");
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
		const mapId = pickMap();
		spawnOnMap(mapId);
		status.Value = `Map ${mapId} — ${ROUND_SECONDS}s`;
		print(`Arena map ${mapId} (${ROUND_SECONDS}s)`);
		for (let left = ROUND_SECONDS; left > 0; left -= 5) {
			status.Value = `Map ${mapId} — ${left}s`;
			task.wait(math.min(5, left));
		}
		awardSurvival();
		status.Value = `Intermission ${INTERMISSION_SECONDS}s`;
		print(`Intermission (${INTERMISSION_SECONDS}s)`);
		task.wait(INTERMISSION_SECONDS);
	}
});
