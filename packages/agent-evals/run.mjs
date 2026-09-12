#!/usr/bin/env node
/**
 * Headless first-try accuracy evals for Blockforge + Claude Code.
 *
 * Usage:
 *   node run.mjs                     # all scenarios
 *   node run.mjs --scenario spawn-lobby
 *   node run.mjs --dry-run           # gates only on fresh template (no Claude)
 *   node run.mjs --runtime           # also run run-in-roblox probes when available
 *   node run.mjs --baseline          # tag results as baseline
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..", "..");
const TEMPLATE_DIR = join(REPO_ROOT, "packages", "project-template");
const SCENARIOS_DIR = join(HERE, "scenarios");
const RESULTS_DIR = join(HERE, "results");
const BOOTSTRAP_MODULE = join(
  REPO_ROOT,
  "apps",
  "desktop",
  "src",
  "shared",
  "agent-bootstrap.ts",
);

function parseArgs(argv) {
  const args = {
    scenario: null,
    dryRun: false,
    runtime: false,
    baseline: false,
    maxScenarios: null,
    model: "sonnet",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") continue;
    if (a === "--dry-run") args.dryRun = true;
    else if (a === "--runtime") args.runtime = true;
    else if (a === "--baseline") args.baseline = true;
    else if (a === "--scenario") args.scenario = argv[++i];
    else if (a === "--max") args.maxScenarios = Number(argv[++i]);
    else if (a === "--model") args.model = argv[++i] || "sonnet";
  }
  return args;
}

function loadScenarios(filterId) {
  const files = readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const scenarios = files.map((f) =>
    JSON.parse(readFileSync(join(SCENARIOS_DIR, f), "utf8")),
  );
  if (filterId) {
    return scenarios.filter((s) => s.id === filterId);
  }
  return scenarios;
}

function run(cmd, args, cwd, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd,
    encoding: "utf8",
    shell: true,
    env: { ...process.env, ...(opts.env ?? {}) },
    timeout: opts.timeout ?? 600_000,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

async function buildBootstrap(projectDir) {
  try {
    const mod = await import(pathToFileURL(BOOTSTRAP_MODULE).href);
    if (typeof mod.buildDynamicBootstrap === "function") {
      return await mod.buildDynamicBootstrap(projectDir);
    }
  } catch {
    // tsx may be required for .ts import
  }
  const viaTsx = run(
    "npx",
    [
      "tsx",
      "-e",
      `import { buildDynamicBootstrap } from ${JSON.stringify(pathToFileURL(BOOTSTRAP_MODULE).href)}; const p = await buildDynamicBootstrap(process.argv[1]); process.stdout.write(p);`,
      projectDir,
    ],
    REPO_ROOT,
    { timeout: 60_000 },
  );
  if (viaTsx.status === 0 && viaTsx.stdout.trim()) {
    return viaTsx.stdout.trim();
  }
  // Fallback static bootstrap
  return "BLOCKFORGE SESSION: Implement Roblox gameplay in this roblox-ts project. Before done: npm run build AND npm run validate:world AND npm run validate:refs.";
}

function prepareWorkdir() {
  const dir = mkdtempSync(join(tmpdir(), "bf-eval-"));
  cpSync(TEMPLATE_DIR, dir, {
    recursive: true,
    filter: (src) => !src.includes("node_modules"),
  });
  const templateNm = join(TEMPLATE_DIR, "node_modules");
  if (existsSync(templateNm)) {
    try {
      symlinkSync(templateNm, join(dir, "node_modules"), "junction");
    } catch {
      const install = run("npm", ["install"], dir, { timeout: 300_000 });
      if (install.status !== 0) {
        throw new Error(`npm install failed in workdir: ${install.stderr}`);
      }
    }
  } else {
    const install = run("npm", ["install"], dir, { timeout: 300_000 });
    if (install.status !== 0) {
      throw new Error(`npm install failed in workdir: ${install.stderr}`);
    }
  }
  mkdirSync(join(dir, ".blockforge"), { recursive: true });
  writeFileSync(
    join(dir, ".blockforge", "session-start.json"),
    JSON.stringify({ startedAt: new Date().toISOString() }, null, 2),
    "utf8",
  );
  return dir;
}

function collectWorldNames(projectDir) {
  const worldDir = join(projectDir, "world");
  const names = new Set();
  if (!existsSync(worldDir)) return names;
  for (const file of readdirSync(worldDir)) {
    if (!file.endsWith(".model.json")) continue;
    try {
      const data = JSON.parse(readFileSync(join(worldDir, file), "utf8"));
      walkNames(data, names);
    } catch {
      // skip
    }
  }
  return names;
}

function walkNames(node, names) {
  if (!node || typeof node !== "object") return;
  if (typeof node.Name === "string") names.add(node.Name);
  if (Array.isArray(node.Children)) {
    for (const child of node.Children) walkNames(child, names);
  }
}

function listFiles(dir, pred, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) listFiles(abs, pred, out);
    else if (pred(abs)) out.push(abs);
  }
  return out;
}

function matchGlob(path, glob) {
  // Minimal ** / * support for our assertions
  const norm = path.replaceAll("\\", "/");
  const re = new RegExp(
    "^" +
      glob
        .replaceAll("\\", "/")
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*") +
      "$",
  );
  return re.test(norm);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertScenario(projectDir, scenario, agentTranscript) {
  const failures = [];
  const assertions = scenario.assertions ?? {};

  if (assertions.buildOk) {
    const r = run("npm", ["run", "build"], projectDir, { timeout: 180_000 });
    if (r.status !== 0) {
      failures.push(`buildOk: build failed\n${(r.stdout + r.stderr).slice(0, 1500)}`);
    }
  }
  if (assertions.validateWorldOk) {
    const r = run("npm", ["run", "validate:world"], projectDir);
    if (r.status !== 0) {
      failures.push(`validateWorldOk: failed\n${(r.stdout + r.stderr).slice(0, 1000)}`);
    }
  }
  if (assertions.validateRefsOk) {
    const r = run("npm", ["run", "validate:refs"], projectDir);
    if (r.status !== 0) {
      failures.push(`validateRefsOk: failed\n${(r.stdout + r.stderr).slice(0, 1000)}`);
    }
  }
  if (assertions.filesExist) {
    for (const rel of assertions.filesExist) {
      if (!existsSync(join(projectDir, rel))) {
        failures.push(`filesExist: missing ${rel}`);
      }
    }
  }
  if (assertions.worldNames) {
    const names = collectWorldNames(projectDir);
    for (const name of assertions.worldNames) {
      if (!names.has(name)) {
        failures.push(`worldNames: missing Name "${name}" in world/*.model.json`);
      }
    }
  }
  if (assertions.srcRegex) {
    for (const rule of assertions.srcRegex) {
      const files = listFiles(projectDir, (p) => {
        const rel = relative(projectDir, p).replaceAll("\\", "/");
        return matchGlob(rel, rule.pathGlob);
      });
      const re = new RegExp(rule.pattern);
      const hit = files.some((f) => re.test(readFileSync(f, "utf8")));
      if (rule.mustNotMatch) {
        if (hit) {
          failures.push(
            `srcRegex: forbidden match /${rule.pattern}/ in ${rule.pathGlob}`,
          );
        }
      } else if (!hit) {
        failures.push(
          `srcRegex: no match /${rule.pattern}/ in ${rule.pathGlob}`,
        );
      }
    }
  }
  if (assertions.remoteNames) {
    const serverSource = listFiles(
      join(projectDir, "src", "server"),
      (path) => path.endsWith(".ts") || path.endsWith(".tsx"),
    )
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const clientSource = listFiles(
      join(projectDir, "src", "client"),
      (path) => path.endsWith(".ts") || path.endsWith(".tsx"),
    )
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
    const allSource = `${serverSource}\n${clientSource}`;
    for (const name of assertions.remoteNames) {
      const quotedName = new RegExp(`["'\`]${escapeRegExp(name)}["'\`]`);
      if (!/RemoteEvent|RemoteFunction/.test(allSource)) {
        failures.push(`remoteNames: no RemoteEvent/RemoteFunction for "${name}"`);
        continue;
      }
      if (!quotedName.test(serverSource)) {
        failures.push(`remoteNames: server does not reference "${name}"`);
      }
      if (!quotedName.test(clientSource)) {
        failures.push(`remoteNames: client does not reference "${name}"`);
      }
    }
  }
  if (assertions.noQuestionAsked && agentTranscript) {
    // Heuristic: agent ended by asking the user a clarifying question
    const asks =
      /\?\s*$/m.test(agentTranscript.trim()) &&
      /\b(which|what|should I|do you want|prefer|confirm)\b/i.test(agentTranscript);
    if (asks && agentTranscript.length < 800) {
      failures.push("noQuestionAsked: transcript looks like a clarifying question");
    }
  }

  return failures;
}

function runClaude(projectDir, prompt, bootstrap, maxTurns, model = "sonnet") {
  const bashQuote = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
  // Prefer Git Bash on Windows for claude
  const isWin = process.platform === "win32";
  const claudeArgs = [
    "-p",
    prompt,
    "--model",
    model,
    "--append-system-prompt",
    bootstrap,
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "Read,Edit,Write,Glob,Grep,Bash(npm run *)",
    "--output-format",
    "json",
    "--max-turns",
    String(maxTurns ?? 12),
  ];

  if (isWin) {
    const bashCandidates = [
      "C:\\Program Files\\Git\\bin\\bash.exe",
      "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
    ];
    const bash = bashCandidates.find((p) => existsSync(p));
    if (bash) {
      const cmd = ["claude", ...claudeArgs.map(bashQuote)].join(" ");
      return run(bash, ["-lc", cmd], projectDir, { timeout: 900_000 });
    }
  }

  return run("claude", claudeArgs, projectDir, { timeout: 900_000 });
}

function runRuntimeProbe(projectDir, probeRel) {
  const probePath = join(HERE, probeRel);
  if (!existsSync(probePath)) {
    return { skipped: true, reason: `probe missing: ${probeRel}` };
  }
  const placePath = join(projectDir, "place.rbxl");
  const build = run(
    "rojo",
    ["build", "default.project.json", "-o", placePath],
    projectDir,
    { timeout: 120_000 },
  );
  if (build.status !== 0) {
    // try local rojo from desktop bin? fall back
    return {
      skipped: false,
      ok: false,
      detail: `rojo build failed: ${(build.stdout + build.stderr).slice(0, 800)}`,
    };
  }
  const probe = run(
    "run-in-roblox",
    ["--place", placePath, "--script", probePath],
    projectDir,
    { timeout: 180_000 },
  );
  if (probe.error && /ENOENT|not recognized/i.test(String(probe.error))) {
    return { skipped: true, reason: "run-in-roblox not installed" };
  }
  const out = probe.stdout + probe.stderr;
  const ok = probe.status === 0 && /\bPASS\b/.test(out);
  return { skipped: false, ok, detail: out.slice(0, 1500) };
}

function summarize(results) {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const firstTry = results.filter((r) => r.passed && r.firstTry).length;
  const lines = [
    `# Agent eval results`,
    "",
    `- Total: ${total}`,
    `- Passed: ${passed} (${total ? Math.round((passed / total) * 100) : 0}%)`,
    `- First-try (passed, no gate retries observed): ${firstTry}`,
    "",
    "| Scenario | Pass | First-try | Turns | Duration | Notes |",
    "|----------|------|-----------|-------|----------|-------|",
  ];
  for (const r of results) {
    lines.push(
      `| ${r.id} | ${r.passed ? "yes" : "no"} | ${r.firstTry ? "yes" : "no"} | ${r.turns ?? "—"} | ${r.durationMs ?? "—"}ms | ${(r.failures?.[0] ?? r.skipReason ?? "").replace(/\|/g, "/").slice(0, 80)} |`,
    );
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let scenarios = loadScenarios(args.scenario);
  if (args.maxScenarios) {
    scenarios = scenarios.slice(0, args.maxScenarios);
  }
  if (scenarios.length === 0) {
    console.error("No scenarios found");
    process.exit(1);
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const tag = args.baseline ? "baseline" : args.dryRun ? "dry-run" : "run";
  const results = [];

  console.log(`Running ${scenarios.length} scenario(s) (${tag})…`);

  if (args.dryRun) {
    const dryStarted = Date.now();
    const workdir = prepareWorkdir();
    try {
      const failures = [];
      for (const script of ["build", "validate:world", "validate:refs"]) {
        const r = run("npm", ["run", script], workdir, { timeout: 180_000 });
        if (r.status !== 0) {
          failures.push(
            `${script}: ${(r.stdout + r.stderr).slice(0, 800)}`,
          );
        }
      }
      const passed = failures.length === 0;
      results.push({
        id: "template-health",
        passed,
        firstTry: passed,
        durationMs: Date.now() - dryStarted,
        failures,
        note: "dry-run: fresh template gates only (no Claude, no scenario asserts)",
      });
      console.log(passed ? "PASS template-health" : `FAIL: ${failures[0]}`);

      const contractFailures = [];
      for (const scenario of scenarios) {
        const assertions = scenario.assertions ?? {};
        if (
          !assertions.buildOk ||
          !assertions.validateWorldOk ||
          !assertions.validateRefsOk
        ) {
          contractFailures.push(
            `${scenario.id}: must assert build, world, and refs gates`,
          );
        }
        if (
          !assertions.worldNames &&
          !assertions.remoteNames &&
          !assertions.srcRegex &&
          !assertions.filesExist
        ) {
          contractFailures.push(
            `${scenario.id}: has no feature-specific static assertion`,
          );
        }
        if (
          scenario.runtimeProbe &&
          !existsSync(join(HERE, scenario.runtimeProbe))
        ) {
          contractFailures.push(
            `${scenario.id}: missing runtime probe ${scenario.runtimeProbe}`,
          );
        }
      }
      const contractsPassed = contractFailures.length === 0;
      results.push({
        id: "scenario-contracts",
        passed: contractsPassed,
        firstTry: contractsPassed,
        durationMs: Date.now() - dryStarted,
        failures: contractFailures,
        note: "dry-run: validates scenario gates, feature assertions, and probe paths",
      });
      console.log(
        contractsPassed
          ? "PASS scenario-contracts"
          : `FAIL: ${contractFailures[0]}`,
      );
    } finally {
      if (process.env.BF_EVAL_KEEP !== "1") {
        try {
          rmSync(workdir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }

    const jsonPath = join(RESULTS_DIR, `${stamp}-${tag}.json`);
    const mdPath = join(RESULTS_DIR, `${stamp}-${tag}.md`);
    const payload = { stamp, tag, args, results };
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
    const md = summarize(results);
    writeFileSync(mdPath, md, "utf8");
    writeFileSync(join(RESULTS_DIR, `latest-${tag}.json`), JSON.stringify(payload, null, 2), "utf8");
    writeFileSync(join(RESULTS_DIR, `latest-${tag}.md`), md, "utf8");
    console.log(`\n${md}`);
    process.exit(results.every((r) => r.passed) ? 0 : 1);
  }

  for (const scenario of scenarios) {
    const started = Date.now();
    console.log(`\n=== ${scenario.id} ===`);
    let workdir = null;
    try {
      workdir = prepareWorkdir();
      const bootstrap = await buildBootstrap(workdir);

      let transcript = "";
      let turns = null;
      let cost = null;
      let claudeOk = true;

      if (!args.dryRun) {
        const claude = runClaude(
          workdir,
          scenario.prompt,
          bootstrap,
          scenario.maxTurns,
          args.model,
        );
        transcript = claude.stdout + "\n" + claude.stderr;
        if (claude.status !== 0 && !claude.stdout.trim()) {
          claudeOk = false;
          results.push({
            id: scenario.id,
            passed: false,
            firstTry: false,
            durationMs: Date.now() - started,
            failures: [
              `claude exited ${claude.status}: ${(claude.stderr || claude.stdout || String(claude.error)).slice(0, 500)}`,
            ],
          });
          continue;
        }
        try {
          const jsonLine = claude.stdout
            .split(/\r?\n/)
            .reverse()
            .find((l) => l.trim().startsWith("{"));
          if (jsonLine) {
            const parsed = JSON.parse(jsonLine);
            turns = parsed.num_turns ?? parsed.turns ?? null;
            cost = parsed.total_cost_usd ?? parsed.cost ?? null;
            if (typeof parsed.result === "string") {
              transcript = parsed.result + "\n" + transcript;
            }
          }
        } catch {
          // keep raw transcript
        }
      }

      const failures = assertScenario(workdir, scenario, transcript);
      let runtime = null;
      if (args.runtime && scenario.runtimeProbe) {
        runtime = runRuntimeProbe(workdir, scenario.runtimeProbe);
        if (!runtime.skipped && !runtime.ok) {
          failures.push(`runtimeProbe: ${runtime.detail}`);
        }
      }

      const passed = failures.length === 0 && claudeOk;
      // firstTry heuristic: passed and transcript does not show repeated validate failures
      const firstTry =
        passed &&
        !/STOP GATE|validate-world: \d+ issue|typecheck failed/i.test(transcript);

      results.push({
        id: scenario.id,
        passed,
        firstTry,
        turns,
        cost,
        durationMs: Date.now() - started,
        failures,
        runtime,
        workdir,
      });
      console.log(
        passed
          ? `PASS${firstTry ? " (first-try)" : ""} in ${Date.now() - started}ms`
          : `FAIL: ${failures[0]}`,
      );
    } catch (err) {
      results.push({
        id: scenario.id,
        passed: false,
        firstTry: false,
        durationMs: Date.now() - started,
        failures: [err instanceof Error ? err.message : String(err)],
      });
      console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (workdir && process.env.BF_EVAL_KEEP !== "1") {
        try {
          rmSync(workdir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }
  }

  const jsonPath = join(RESULTS_DIR, `${stamp}-${tag}.json`);
  const mdPath = join(RESULTS_DIR, `${stamp}-${tag}.md`);
  const payload = {
    stamp,
    tag,
    args,
    results: results.map(({ workdir: _w, ...rest }) => rest),
  };
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");
  const md = summarize(results);
  writeFileSync(mdPath, md, "utf8");
  // Also write latest pointers
  writeFileSync(join(RESULTS_DIR, `latest-${tag}.json`), JSON.stringify(payload, null, 2), "utf8");
  writeFileSync(join(RESULTS_DIR, `latest-${tag}.md`), md, "utf8");

  console.log(`\n${md}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);

  const allPassed = results.every((r) => r.passed);
  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
