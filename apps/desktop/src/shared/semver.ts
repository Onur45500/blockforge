/** Numeric semver compare for X.Y.Z (extra suffix ignored). */

export function parseSemver(raw: string): [number, number, number] {
  const match = raw.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return [0, 0, 0];
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(a: string, b: string): number {
  const aa = parseSemver(a);
  const bb = parseSemver(b);
  for (let i = 0; i < 3; i += 1) {
    const left = aa[i] ?? 0;
    const right = bb[i] ?? 0;
    if (left !== right) {
      return left - right;
    }
  }
  return 0;
}
