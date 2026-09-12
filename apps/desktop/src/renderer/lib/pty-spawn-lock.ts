const inflight = new Map<string, Promise<string>>();

/** Share one in-flight PTY start so React Strict Mode cannot spawn twice. */
export function withPtyStartLock(
  key: string,
  start: () => Promise<string>,
): Promise<string> {
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }
  const promise = start().finally(() => {
    if (inflight.get(key) === promise) {
      inflight.delete(key);
    }
  });
  inflight.set(key, promise);
  return promise;
}

export function ptyStartLockKey(options: {
  kind: string;
  projectPath: string;
  adapterId?: string;
  label?: string;
}): string {
  return [
    options.kind,
    options.projectPath,
    options.adapterId ?? "",
    options.label ?? "",
  ].join("\0");
}
