/**
 * REFERENCE ONLY — copy into src/server/ after importing a tree from the Asset bank.
 * Not compiled from docs/examples.
 *
 * placeModelAsset only accepts keys from shared/assets.ts. Prefer kenney_tree /
 * quat_tree_pine / quat_tree_oak. Never invent Cylinder+Ball trees.
 */
import { ASSETS, type AssetKey } from "shared/assets";
import { placeModelAsset } from "shared/placeModel";

const PREFERRED_KEYS = ["kenney_tree", "quat_tree_pine", "quat_tree_oak"] as const;

function pickTreeKey(): AssetKey | undefined {
	for (const preferred of PREFERRED_KEYS) {
		for (const [key] of pairs(ASSETS)) {
			if (key === preferred) {
				return key;
			}
		}
	}
	for (const [key] of pairs(ASSETS)) {
		return key;
	}
	return undefined;
}

const treeKey = pickTreeKey();
if (treeKey !== undefined) {
	// Near SpawnPlatform ground top (~Y 11). Adjust after Play if needed.
	placeModelAsset(treeKey, new CFrame(-18, 11, 8), "SpawnTree1");
	placeModelAsset(treeKey, new CFrame(18, 11, -6), "SpawnTree2");
} else {
	print(
		"nature/place-trees: import kenney_tree (or quat_tree_pine / quat_tree_oak) in Blockforge Assets first — do not build Cylinder+Ball trees",
	);
}
