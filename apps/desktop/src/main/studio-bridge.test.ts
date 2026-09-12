import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import {
  StudioBridge,
  computeStudioSyncStatus,
} from "./studio-bridge.js";

describe("computeStudioSyncStatus", () => {
  it("returns world-missing when disk has files but Studio has no World", () => {
    assert.equal(
      computeStudioSyncStatus({
        hasDiskWorldFiles: true,
        snapshot: {
          ts: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          running: true,
          worldPresent: false,
          worldChildren: [],
          spawnLocations: [],
          serverScripts: [],
          rojoTsPresent: false,
        },
      }),
      "world-missing",
    );
  });

  it("returns in-sync when World is present", () => {
    assert.equal(
      computeStudioSyncStatus({
        hasDiskWorldFiles: true,
        snapshot: {
          ts: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          running: false,
          worldPresent: true,
          worldChildren: [{ name: "GroundPlatform", className: "Part" }],
          spawnLocations: [],
          serverScripts: [],
          rojoTsPresent: true,
        },
      }),
      "in-sync",
    );
  });
});

describe("StudioBridge", () => {
  const bridges: StudioBridge[] = [];

  after(async () => {
    for (const bridge of bridges) {
      await bridge.stop();
    }
  });

  it("accepts POST /log and appends JSONL under .blockforge", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-bridge-"));
    const bridge = new StudioBridge({ port: 0 });
    bridges.push(bridge);
    const port = await bridge.start(dir);

    const status = bridge.getStatus();
    assert.equal(status.running, true);
    assert.equal(status.port, port);
    assert.ok(port > 0);

    const response = await fetch(`http://127.0.0.1:${port}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entries: [
          {
            ts: new Date().toISOString(),
            level: "error",
            message: 'Infinite yield possible on WaitForChild("MissingPad")',
            source: "ScriptContext",
          },
        ],
      }),
    });
    assert.equal(response.ok, true);

    const log = await readFile(join(dir, ".blockforge", "studio-output.jsonl"), "utf8");
    assert.match(log, /MissingPad/);
    assert.match(bridge.getStatus().lastRuntimeError ?? "", /MissingPad/);

    const health = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(health.ok, true);

    await bridge.stop();
    await rm(dir, { recursive: true, force: true });
  });

  it("accepts POST /state and reports world-missing when disk has models", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-bridge-state-"));
    await mkdir(join(dir, "world"), { recursive: true });
    await writeFile(
      join(dir, "world", "SpawnPlatform.model.json"),
      JSON.stringify({
        ClassName: "Model",
        Children: [
          {
            Name: "GroundPlatform",
            ClassName: "Part",
            Properties: { Anchored: true, Size: [40, 2, 40], Position: [0, 10, 0] },
          },
        ],
      }),
      "utf8",
    );

    const bridge = new StudioBridge({ port: 0 });
    bridges.push(bridge);
    const port = await bridge.start(dir);

    const response = await fetch(`http://127.0.0.1:${port}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ts: new Date().toISOString(),
        running: true,
        worldPresent: false,
        worldChildren: [],
        spawnLocations: [],
        serverScripts: [],
        rojoTsPresent: false,
      }),
    });
    assert.equal(response.ok, true);

    const status = bridge.getStatus();
    assert.equal(status.studioWorldPresent, false);
    assert.equal(status.studioSyncStatus, "world-missing");

    const stateFile = await readFile(join(dir, ".blockforge", "studio-state.json"), "utf8");
    assert.match(stateFile, /"worldPresent": false/);

    await bridge.stop();
    await rm(dir, { recursive: true, force: true });
  });

  it("writes Studio exports with stable validated filenames", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bf-bridge-export-"));
    const bridge = new StudioBridge({ port: 0 });
    bridges.push(bridge);
    const port = await bridge.start(dir);
    const url = `http://127.0.0.1:${port}/export`;
    const filename = "StudioWorld.model.json";

    const first = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exports: [{ filename, content: { Name: "World", ClassName: "Folder" } }],
      }),
    });
    assert.equal(first.ok, true);

    const second = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exports: [
          {
            filename,
            content: {
              Name: "World",
              ClassName: "Folder",
              Children: [{ Name: "Spawn", ClassName: "SpawnLocation" }],
            },
          },
        ],
      }),
    });
    assert.equal(second.ok, true);

    const exportPath = join(
      dir,
      ".blockforge",
      "studio-exports",
      filename,
    );
    const saved = await readFile(exportPath, "utf8");
    assert.match(saved, /"Spawn"/);

    const invalid = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exports: [
          {
            filename: "../outside.model.json",
            content: { Name: "Unsafe", ClassName: "Folder" },
          },
        ],
      }),
    });
    assert.equal(invalid.status, 400);

    await bridge.stop();
    await rm(dir, { recursive: true, force: true });
  });
});
