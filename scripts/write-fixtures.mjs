import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = "packages/asset-bank/fixtures";
mkdirSync(dir, { recursive: true });

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
writeFileSync(join(dir, "sample.png"), png);

const fbx = `; FBX 7.4.0 project file
FBXHeaderExtension:  {
    FBXHeaderVersion: 1003
    FBXVersion: 7400
}
Definitions:  {
    Version: 100
}
Objects:  {
}
Connections:  {
}
`;
writeFileSync(join(dir, "sample.fbx"), fbx);
console.log("fixtures written");
