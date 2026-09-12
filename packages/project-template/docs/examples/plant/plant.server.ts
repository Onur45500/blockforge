/**
 * REFERENCE ONLY — copy into src/server/ for plant → grow → harvest coins.
 * Not compiled from docs/examples.
 *
 * ProximityPrompt on PlanterBed. Empty → plant, wait GROW_SECONDS, harvest once.
 * Crop Part is created in TypeScript (Anchored). Needs leaderstats/Coins.
 */
// blockforge:dynamic-parts — Crop Parts are runtime props, not scenery.
import { Workspace } from "@rbxts/services";

const GROW_SECONDS = 8;
const HARVEST_COINS = 8;

type BedPhase = "empty" | "growing" | "ready";

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

function placeCrop(bed: BasePart, grown: boolean): BasePart {
	const world = bed.Parent;
	const crop = new Instance("Part");
	crop.Name = "Crop";
	crop.Anchored = true;
	crop.CanCollide = false;
	crop.Material = Enum.Material.Grass;
	crop.Color = grown ? Color3.fromRGB(80, 180, 70) : Color3.fromRGB(90, 140, 60);
	crop.Size = grown ? new Vector3(1.4, 3, 1.4) : new Vector3(0.6, 1, 0.6);
	crop.CFrame = bed.CFrame.add(new Vector3(0, grown ? 2 : 1, 0));
	crop.Parent = world;
	return crop;
}

const bed = findWorldPart("PlanterBed");
if (bed !== undefined) {
	let phase: BedPhase = "empty";
	let crop: BasePart | undefined;

	const prompt = new Instance("ProximityPrompt");
	prompt.ActionText = "Plant";
	prompt.ObjectText = "Planter";
	prompt.HoldDuration = 0;
	prompt.MaxActivationDistance = 12;
	prompt.RequiresLineOfSight = false;
	prompt.Parent = bed;

	prompt.Triggered.Connect((player) => {
		if (phase === "growing") {
			return;
		}
		if (phase === "empty") {
			phase = "growing";
			prompt.Enabled = false;
			prompt.ActionText = "Growing…";
			crop = placeCrop(bed, false);
			task.delay(GROW_SECONDS, () => {
				if (crop !== undefined) {
					crop.Destroy();
				}
				crop = placeCrop(bed, true);
				phase = "ready";
				prompt.ActionText = "Harvest";
				prompt.Enabled = true;
			});
			print(`${player.Name} planted a crop`);
			return;
		}

		phase = "empty";
		if (crop !== undefined) {
			crop.Destroy();
			crop = undefined;
		}
		prompt.ActionText = "Plant";
		const coins = coinsValue(player);
		if (coins !== undefined) {
			coins.Value += HARVEST_COINS;
		}
		print(`${player.Name} harvested +${HARVEST_COINS} coins`);
	});
}
