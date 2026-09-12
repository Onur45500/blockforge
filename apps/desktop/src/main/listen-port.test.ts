import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isReclaimableRojoListener,
  parseLsofPids,
  parseNetstatListeningPids,
} from "./listen-port.js";

describe("parseNetstatListeningPids", () => {
  it("extracts the LISTENING pid for the exact port", () => {
    const stdout = [
      "TCP    127.0.0.1:34872        0.0.0.0:0              LISTENING       54196",
      "TCP    127.0.0.1:34873        0.0.0.0:0              LISTENING       16100",
      "TCP    127.0.0.1:348720       0.0.0.0:0              LISTENING       99",
    ].join("\r\n");
    assert.deepEqual(parseNetstatListeningPids(stdout, 34872), [54196]);
  });
});

describe("parseLsofPids", () => {
  it("parses lsof -t output", () => {
    assert.deepEqual(parseLsofPids("441\n442\n"), [441, 442]);
  });
});

describe("isReclaimableRojoListener", () => {
  const exePath =
    "C:\\Users\\onura\\AppData\\Roaming\\@blockforge\\desktop\\bin\\rojo.exe";

  it("reclaims Blockforge leftover rojo.exe by image name", () => {
    assert.equal(
      isReclaimableRojoListener({
        commandLine: null,
        imageName: "rojo.exe",
        exePath,
      }),
      true,
    );
  });

  it("reclaims when the command line is our managed binary", () => {
    assert.equal(
      isReclaimableRojoListener({
        commandLine: `"${exePath}" serve --port 34872`,
        imageName: "rojo.exe",
        exePath,
      }),
      true,
    );
  });

  it("does not reclaim unrelated listeners", () => {
    assert.equal(
      isReclaimableRojoListener({
        commandLine: "C:\\Windows\\System32\\svchost.exe -k netsvcs",
        imageName: "svchost.exe",
        exePath,
      }),
      false,
    );
  });
});
