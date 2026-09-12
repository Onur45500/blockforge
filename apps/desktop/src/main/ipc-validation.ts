import { createRequire } from "node:module";
import { isAbsolute, normalize, relative, resolve } from "node:path";
import { z } from "zod";

const require = createRequire(import.meta.url);

const agentIdSchema = z.enum([
  "claude-code",
  "codex",
  "opencode",
  "antigravity",
]);

function getUserDataPath(): string | null {
  try {
    const electron = require("electron") as {
      app?: { isReady: () => boolean; getPath: (name: string) => string };
    };
    const app = electron.app;
    if (!app?.isReady?.()) {
      return null;
    }
    return app.getPath("userData");
  } catch {
    return null;
  }
}

export function pathIsInsideRoot(root: string, candidate: string): boolean {
  const resolvedRoot = normalize(resolve(root));
  const resolvedCandidate = normalize(resolve(candidate));
  const rel = relative(resolvedRoot, resolvedCandidate);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Absolute path strings used by IPC (null bytes rejected). */
export const projectPathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.includes("\0"), "Invalid path")
  .superRefine((p, ctx) => {
    const userData = getUserDataPath();
    if (!userData) return;
    if (!pathIsInsideRoot(resolve(userData, "projects"), p)) {
      ctx.addIssue({
        code: "custom",
        message: "Path must be under the Blockforge projects directory",
      });
    }
  });

export const backupZipPathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.includes("\0"), "Invalid path")
  .superRefine((p, ctx) => {
    const userData = getUserDataPath();
    if (!userData) return;
    if (!pathIsInsideRoot(resolve(userData, "backups"), p)) {
      ctx.addIssue({
        code: "custom",
        message: "Zip path must be under the Blockforge backups directory",
      });
    }
  });

export const backupDestPathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.includes("\0"), "Invalid path")
  .superRefine((p, ctx) => {
    const userData = getUserDataPath();
    if (!userData) return;
    if (!pathIsInsideRoot(resolve(userData, "projects"), p)) {
      ctx.addIssue({
        code: "custom",
        message: "Restore destination must be under the Blockforge projects directory",
      });
    }
  });

export const optionalFilePathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.includes("\0"), "Invalid path")
  .optional();

const ptyKindSchema = z.enum(["agent", "shell"]);

export const ptyStartSchema = z.object({
  projectPath: projectPathSchema,
  cols: z.number().int().positive().max(500),
  rows: z.number().int().positive().max(200),
  kind: ptyKindSchema.optional(),
  adapterId: agentIdSchema.optional(),
  resume: z.boolean().optional(),
  replaceSessionId: z.string().min(1).optional(),
  label: z.string().min(1).max(80).optional(),
  role: z.string().min(1).max(80).optional(),
  source: z.enum(["ui", "agent"]).optional(),
  focus: z.boolean().optional(),
});

export const ptySessionIdSchema = z.object({
  sessionId: z.string().min(1),
});

export const ptyWriteSchema = z.object({
  sessionId: z.string().min(1),
  data: z.string(),
});

export const ptyResizeSchema = z.object({
  sessionId: z.string().min(1),
  cols: z.number().int().positive().max(500),
  rows: z.number().int().positive().max(200),
});

export const ptyListSchema = z
  .object({
    projectPath: projectPathSchema.optional(),
    adapterId: agentIdSchema.optional(),
    kind: ptyKindSchema.optional(),
  })
  .optional();

export const projectIdSchema = z.string().min(1).max(200);

export const assetImportSchema = z.object({
  projectPath: projectPathSchema,
  catalogAssetId: z.string().min(1),
  key: z.string().min(1).max(120),
  filePath: optionalFilePathSchema,
});

export const stylePackActivateSchema = z.object({
  projectPath: projectPathSchema,
  packId: z.string().min(1).max(120).optional(),
});

export function parseIpc<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`Invalid ${label}: ${result.error.issues[0]?.message ?? "validation failed"}`);
  }
  return result.data;
}
