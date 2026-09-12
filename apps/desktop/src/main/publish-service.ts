import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { constants } from "node:fs";
import { promisify } from "node:util";
import {
  OpenCloudClient,
  mapOpenCloudError,
} from "@blockforge/open-cloud";
import type { PublishRequest, PublishResult } from "../shared/ipc-types.js";
import { getPublishConfig } from "./open-cloud-store.js";

const execFileAsync = promisify(execFile);

async function runRojoBuild(projectPath: string, rojoExe: string): Promise<string> {
  const outDir = join(projectPath, "dist");
  await mkdir(outDir, { recursive: true });
  const placePath = join(outDir, "place.rbxl");

  // Compile before packaging so out/ is fresh.
  await execFileAsync("npx", ["rbxtsc"], {
    cwd: projectPath,
    windowsHide: true,
    shell: true,
  });
  try {
    await execFileAsync("node", ["./scripts/copy-include.mjs"], {
      cwd: projectPath,
      windowsHide: true,
      shell: true,
    });
  } catch {
    // include may already exist
  }

  await execFileAsync(rojoExe, ["build", "-o", placePath], {
    cwd: projectPath,
    windowsHide: true,
    shell: process.platform === "win32",
  });

  await access(placePath, constants.F_OK);
  return placePath;
}

function resolveRojoExe(userDataBin: string): string {
  return join(userDataBin, process.platform === "win32" ? "rojo.exe" : "rojo");
}

export async function publishPlace(
  request: PublishRequest,
  userDataBin: string,
): Promise<PublishResult> {
  const config = await getPublishConfig();
  if (!config) {
    return {
      success: false,
      error: {
        kind: "unknown",
        message:
          "Open Cloud is not configured. Set API key, universe ID, and place ID in Settings.",
        status: 0,
      },
    };
  }

  const rojoExe = resolveRojoExe(userDataBin);

  try {
    const placePath = await runRojoBuild(request.projectPath, rojoExe);
    const client = new OpenCloudClient({ apiKey: config.apiKey });
    const result = await client.publishPlace({
      universeId: config.universeId,
      placeId: config.placeId,
      placeFilePath: placePath,
      versionType: request.versionType ?? "Published",
    });

    try {
      await mkdir(join(request.projectPath, ".blockforge"), { recursive: true });
      await writeFile(
        join(request.projectPath, ".blockforge", "publish.json"),
        `${JSON.stringify(
          {
            placeId: config.placeId,
            universeId: config.universeId,
            versionNumber: result.versionNumber,
            versionType: request.versionType ?? "Published",
            publishedAt: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
    } catch {
      // Non-fatal: publish already succeeded
    }

    return { success: true, versionNumber: result.versionNumber };
  } catch (error) {
    return { success: false, error: mapOpenCloudError(error) };
  }
}
