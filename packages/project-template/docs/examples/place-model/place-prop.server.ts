/**
 * REFERENCE ONLY — copy into src/server/ after importing a model in the Asset bank.
 * Not compiled from docs/examples.
 *
 * placeModelAsset only accepts keys from shared/assets.ts. Never invent rbxassetid://.
 */
import { ASSETS, type AssetKey } from "shared/assets";
import { placeModelAsset } from "shared/placeModel";

let first: AssetKey | undefined;
for (const [key] of pairs(ASSETS)) {
	first = key;
	break;
}
if (first !== undefined) {
	placeModelAsset(first, new CFrame(20, 12, 0), "BankProp");
} else {
	print("place-prop example: import a CC0 model in Blockforge Assets first");
}
