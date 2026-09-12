import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  compareSemver,
  upgradeProjectTemplate,
} from "./template-upgrade.js";

const TEMPLATE_DIR = join(
  fileURLToPath(new URL(".", import.meta.url)),
  "../../../../packages/project-template",
);

describe("compareSemver", () => {
  it("orders versions", () => {
    assert.ok(compareSemver("0.1.0", "0.3.0") < 0);
    assert.ok(compareSemver("0.3.0", "0.3.0") === 0);
    assert.ok(compareSemver("0.4.0", "0.3.0") > 0);
  });
});

describe("upgradeProjectTemplate", () => {
  it("upgrades 0.1.0 fixture with validate scripts and keeps src/", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-upgrade-"));
    await mkdir(join(dir, "src", "server"), { recursive: true });
    await mkdir(join(dir, "world"), { recursive: true });
    await mkdir(join(dir, ".blockforge"), { recursive: true });

    await writeFile(
      join(dir, "package.json"),
      JSON.stringify(
        {
          name: "old-game",
          scripts: { build: "rbxtsc && node ./scripts/copy-include.mjs" },
          blockforge: { templateVersion: "0.1.0" },
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(dir, "blockforge.json"),
      JSON.stringify({ templateVersion: "0.1.0" }, null, 2),
      "utf8",
    );
    await writeFile(
      join(dir, ".blockforge", "meta.json"),
      JSON.stringify(
        {
          id: "old-1",
          name: "Old",
          templateVersion: "0.1.0",
          createdAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
    await writeFile(
      join(dir, "src", "server", "main.server.ts"),
      'print("keep me")\n',
      "utf8",
    );
    await writeFile(
      join(dir, "world", "SpawnPlatform.model.json"),
      JSON.stringify({ ClassName: "Model", Children: [] }),
      "utf8",
    );
    await writeFile(
      join(dir, "assets.json"),
      JSON.stringify({ assets: {} }),
      "utf8",
    );

    const result = await upgradeProjectTemplate(dir, TEMPLATE_DIR);
    assert.equal(result.upgraded, true);
    assert.equal(result.from, "0.1.0");
    assert.match(result.to, /^0\.\d+\.\d+/);

    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8")) as {
      name: string;
      scripts: Record<string, string>;
    };
    assert.equal(pkg.name, "old-game");
    assert.ok(pkg.scripts["validate:world"]);
    assert.ok(pkg.scripts["validate:refs"]);
    assert.ok(pkg.scripts["map-toolkit"]);
    assert.ok(pkg.scripts["lookup-asset"]);
    assert.ok(pkg.scripts["notes"]);
    assert.ok(pkg.scripts["clean-restart"]);
    assert.ok(pkg.scripts["audit-scenery"]);
    assert.ok(pkg.scripts["skills"]);

    const mappingSkill = await readFile(
      join(dir, ".claude", "skills", "mapping", "SKILL.md"),
      "utf8",
    );
    assert.match(mappingSkill, /MapToolkit/);

    const toolkit = await readFile(
      join(dir, "studio-tools", "MapToolkit.luau"),
      "utf8",
    );
    assert.match(toolkit, /function MapToolkit.groundY/);

    const projectJson = await readFile(join(dir, "default.project.json"), "utf8");
    assert.match(projectJson, /studio-tools/);

    const src = await readFile(join(dir, "src", "server", "main.server.ts"), "utf8");
    assert.match(src, /keep me/);

    const claude = await readFile(join(dir, "CLAUDE.md"), "utf8");
    assert.match(claude, /Blockforge/);

    const settings = await readFile(join(dir, ".claude", "settings.json"), "utf8");
    assert.match(settings, /Stop/);

    const bf = JSON.parse(await readFile(join(dir, "blockforge.json"), "utf8")) as {
      templateVersion: string;
    };
    assert.equal(bf.templateVersion, result.to);

    // Second open is a no-op
    const again = await upgradeProjectTemplate(dir, TEMPLATE_DIR);
    assert.equal(again.upgraded, false);
  });
});
