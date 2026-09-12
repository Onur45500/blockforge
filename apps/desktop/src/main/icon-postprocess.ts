import { readFile, writeFile } from "node:fs/promises";
import { Jimp } from "jimp";

/** Outlined icons are written as `name-icon.png` by postProcessIconFile. */
export function isOutlinedIconPath(filePath: string): boolean {
  return /-icon\.[^.]+$/i.test(filePath.replace(/\\/g, "/"));
}

/**
 * Chroma-key near-white / near-green backgrounds, add a 1px black outline, normalize to 256².
 */
export async function postProcessIconFile(inputPath: string): Promise<string> {
  const image = await Jimp.read(inputPath);
  image.resize({ w: 256, h: 256 });

  const { width: w, height: h, data } = image.bitmap;
  const opaque = new Uint8Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const r = data[idx] ?? 0;
    const g = data[idx + 1] ?? 0;
    const b = data[idx + 2] ?? 0;
    const a = data[idx + 3] ?? 255;
    const nearWhite = r > 245 && g > 245 && b > 245;
    const nearGreen = g > 200 && r < 80 && b < 80;
    if (nearWhite || nearGreen || a < 16) {
      data[idx + 3] = 0;
      opaque[i] = 0;
    } else {
      opaque[i] = 1;
    }
  }

  const outline = new Set<number>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!opaque[i]) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!opaque[ni]) outline.add(ni);
      }
    }
  }

  for (const i of outline) {
    const idx = i * 4;
    data[idx] = 0;
    data[idx + 1] = 0;
    data[idx + 2] = 0;
    data[idx + 3] = 255;
  }

  const outPath = inputPath.replace(/(\.[^.]+)$/, "-icon$1");
  await image.write(outPath as `${string}.png`);
  // touch for FS watchers
  await writeFile(outPath, await readFile(outPath));
  return outPath;
}
