import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { OpenCloudClient } from "@blockforge/open-cloud";
import type {
  CreateMonetizationRequest,
  CreateMonetizationResult,
  MonetizationProduct,
} from "../shared/ipc-types.js";
import { getPublishConfig } from "./open-cloud-store.js";

type MonetizationFile = {
  products: MonetizationProduct[];
};

function monetizationPath(projectPath: string): string {
  return join(projectPath, "monetization.json");
}

async function readFileProducts(projectPath: string): Promise<MonetizationFile> {
  try {
    const raw = await readFile(monetizationPath(projectPath), "utf8");
    return JSON.parse(raw) as MonetizationFile;
  } catch {
    return { products: [] };
  }
}

async function writeFileProducts(
  projectPath: string,
  file: MonetizationFile,
): Promise<void> {
  await writeFile(monetizationPath(projectPath), JSON.stringify(file, null, 2), "utf8");
}

export async function listMonetizationProducts(
  projectPath: string,
): Promise<MonetizationProduct[]> {
  const file = await readFileProducts(projectPath);
  return file.products;
}

export async function createMonetizationProduct(
  request: CreateMonetizationRequest,
): Promise<CreateMonetizationResult> {
  const name = request.name.trim();
  if (!name) {
    return { success: false, message: "Product name is required" };
  }

  const config = await getPublishConfig();
  let remoteId: string | null = null;

  if (config) {
    try {
      const client = new OpenCloudClient({ apiKey: config.apiKey });
      if (request.kind === "developer-product") {
        const created = await client.createDeveloperProduct({
          universeId: config.universeId,
          name,
          description: `Created via Blockforge`,
          priceInRobux: request.priceInRobux,
        });
        remoteId = created.id;
      } else {
        const created = await client.createGamePass({
          universeId: config.universeId,
          name,
          description: `Created via Blockforge`,
          priceInRobux: request.priceInRobux,
        });
        remoteId = created.id;
      }
    } catch (err) {
      // Fall through to local scaffolding so UX still works offline / API-gap
      console.warn(
        "[blockforge] Open Cloud monetization call failed; storing local scaffold:",
        err,
      );
    }
  }

  const product: MonetizationProduct = {
    id: remoteId ?? `local-${randomUUID()}`,
    name,
    kind: request.kind,
    priceInRobux: request.priceInRobux,
    liveOnRoblox: remoteId !== null,
  };

  const file = await readFileProducts(request.projectPath);
  file.products.push(product);
  await writeFileProducts(request.projectPath, file);

  // Agent-facing snippet
  await mkdir(join(request.projectPath, "docs"), { recursive: true });
  await writeFile(
    join(request.projectPath, "docs", "monetization.md"),
    `# Monetization

Products are listed in \`monetization.json\`. Prompt example:

\`\`\`ts
MarketplaceService.PromptProductPurchase(player, PRODUCT_ID)
\`\`\`

Replace PRODUCT_ID with an id from monetization.json.
`,
    "utf8",
  );

  return {
    success: true,
    product,
    message:
      remoteId !== null
        ? `Created on Roblox with id ${remoteId}.`
        : "Saved as a local scaffold only — this product is NOT live on Roblox. Configure valid Open Cloud credentials and create it again to publish it.",
  };
}
