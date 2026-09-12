/**
 * Place uploaded Mesh/Model assets into the world.
 * Prefer this (or world/*.model.json) for static scenery — not Part-spam scripts.
 */
import { InsertService, Workspace } from "@rbxts/services";
import type { AssetKey } from "./assets";
import { ASSETS } from "./assets";

function assetNumericId(key: AssetKey): number {
	const uri = ASSETS[key];
	const match = string.match(uri, "%d+")[0];
	assert(match !== undefined, `Invalid asset id for ${key}: ${uri}`);
	return tonumber(match)!;
}

/**
 * Load an Open Cloud / Toolbox model asset and parent it under Workspace.World (or Workspace).
 * Asset must already exist in shared/assets.ts (imported via Blockforge asset bank).
 */
export function placeModelAsset(
	key: AssetKey,
	cframe: CFrame,
	name?: string,
): Model {
	const id = assetNumericId(key);
	const container = InsertService.LoadAsset(id);
	const model = container.GetChildren()[0] as Model | undefined;
	assert(model !== undefined && model.IsA("Model"), `Asset ${key} did not contain a Model`);

	for (const descendant of model.GetDescendants()) {
		if (descendant.IsA("BasePart")) {
			descendant.Anchored = true;
		}
	}

	model.Name = name ?? key;
	model.PivotTo(cframe);

	const world = Workspace.FindFirstChild("World");
	model.Parent = world ?? Workspace;
	container.Destroy();
	return model;
}
