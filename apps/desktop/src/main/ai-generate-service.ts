import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import {
  getDecryptedElevenLabsApiKey,
  getDecryptedGeminiApiKey,
  getDecryptedMeshyApiKey,
} from "./open-cloud-store.js";
import { postProcessIconFile } from "./icon-postprocess.js";

export type GenerateAssetRequest = {
  projectPath: string;
  provider: "gemini" | "meshy" | "elevenlabs";
  prompt: string;
  /** Run icon chroma-key + outline after Gemini image write. */
  postProcessIcon?: boolean;
  /** Optional source image for Gemini edit_icon (unoutlined PNG). */
  sourceImagePath?: string;
};

export type GenerateAssetResult =
  | {
      success: true;
      provider: string;
      outputPath: string;
      detail: string;
    }
  | { success: false; message: string };

/**
 * User-key AI generation. Never uses Blockforge-hosted keys.
 * Gemini path is fully wired for image bytes when a key is present;
 * Meshy/ElevenLabs return clear guidance until binary pipelines are expanded.
 */
export async function generateAsset(
  request: GenerateAssetRequest,
): Promise<GenerateAssetResult> {
  const prompt = request.prompt.trim();
  if (!prompt) {
    return { success: false, message: "Prompt is required." };
  }

  const outDir = join(request.projectPath, ".blockforge", "generated");
  await mkdir(outDir, { recursive: true });

  if (request.provider === "gemini") {
    const apiKey = await getDecryptedGeminiApiKey();
    if (!apiKey) {
      return {
        success: false,
        message: "Add a Gemini API key in Settings (user-owned keys only).",
      };
    }
    try {
      const requestParts: Array<
        | { text: string }
        | { inlineData: { mimeType: string; data: string } }
      > = [{ text: prompt }];
      if (request.sourceImagePath) {
        const bytes = await readFile(request.sourceImagePath);
        const ext = extname(request.sourceImagePath).toLowerCase();
        const mimeType =
          ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
        requestParts.push({
          inlineData: { mimeType, data: bytes.toString("base64") },
        });
      }
      const url =
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${encodeURIComponent(apiKey)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: requestParts }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          message: `Gemini error (${response.status}): ${body.slice(0, 400)}`,
        };
      }
      const json = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> };
        }>;
      };
      const responseParts = json.candidates?.[0]?.content?.parts ?? [];
      const imagePart = responseParts.find((p) => p.inlineData?.data);
      if (!imagePart?.inlineData?.data) {
        const text = responseParts.map((p) => p.text).filter(Boolean).join("\n");
        const stubPath = join(outDir, `gemini-${randomUUID()}.txt`);
        await writeFile(stubPath, text || "No image returned.", "utf8");
        return {
          success: true,
          provider: "gemini",
          outputPath: stubPath,
          detail:
            "Gemini returned text only (no inline image). Saved response under .blockforge/generated.",
        };
      }
      const ext =
        imagePart.inlineData.mimeType?.includes("jpeg") ? "jpg" : "png";
      const outPath = join(outDir, `gemini-${randomUUID()}.${ext}`);
      await writeFile(outPath, Buffer.from(imagePart.inlineData.data, "base64"));
      let finalPath = outPath;
      let detail = "Image saved. Upload via Assets when ready.";
      if (request.postProcessIcon) {
        try {
          finalPath = await postProcessIconFile(outPath);
          detail = "Icon saved with chroma-key + outline under .blockforge/generated.";
        } catch (err) {
          detail = `Image saved; icon post-process failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
      return {
        success: true,
        provider: "gemini",
        outputPath: finalPath,
        detail,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  if (request.provider === "meshy") {
    const apiKey = await getDecryptedMeshyApiKey();
    if (!apiKey) {
      return {
        success: false,
        message: "Add a Meshy API key in Settings.",
      };
    }
    return {
      success: false,
      message:
        "Meshy generation is coming soon. Your API key is configured, but Blockforge does not submit or poll 3D generation jobs yet.",
    };
  }

  const apiKey = await getDecryptedElevenLabsApiKey();
  if (!apiKey) {
    return {
      success: false,
      message: "Add an ElevenLabs API key in Settings.",
    };
  }
  return {
    success: false,
    message:
      "ElevenLabs generation is coming soon. Your API key is configured, but Blockforge does not generate or save audio yet.",
  };
}
