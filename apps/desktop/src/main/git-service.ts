import { simpleGit, type SimpleGit } from "simple-git";
import { studioLocks } from "./studio-locks.js";

export type GitStatusEntry = {
  path: string;
  index: string;
  working_dir: string;
};

export type GitStatusResult = {
  current: string | null;
  tracking: string | null;
  ahead: number;
  behind: number;
  files: GitStatusEntry[];
  isRepo: boolean;
};

function git(projectPath: string): SimpleGit {
  return simpleGit({ baseDir: projectPath });
}

function assertNotPlaytesting(op: string): void {
  if (studioLocks.isPlaytestHeld()) {
    throw new Error(
      `Refusing git ${op} while a playtest lock is held. Wait for playtest_check to finish.`,
    );
  }
}

export async function gitStatus(projectPath: string): Promise<GitStatusResult> {
  const g = git(projectPath);
  const isRepo = await g.checkIsRepo();
  if (!isRepo) {
    return {
      current: null,
      tracking: null,
      ahead: 0,
      behind: 0,
      files: [],
      isRepo: false,
    };
  }
  const status = await g.status();
  return {
    current: status.current,
    tracking: status.tracking,
    ahead: status.ahead,
    behind: status.behind,
    files: status.files.map((f) => ({
      path: f.path,
      index: f.index,
      working_dir: f.working_dir,
    })),
    isRepo: true,
  };
}

export async function gitDiff(
  projectPath: string,
  staged = false,
): Promise<string> {
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    return "";
  }
  return staged ? g.diff(["--cached"]) : g.diff();
}

export async function gitStage(
  projectPath: string,
  paths: string[],
): Promise<void> {
  assertNotPlaytesting("stage");
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    throw new Error("Not a git repository");
  }
  await g.add(paths.length > 0 ? paths : ["."]);
}

export async function gitUnstage(
  projectPath: string,
  paths: string[],
): Promise<void> {
  assertNotPlaytesting("unstage");
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    throw new Error("Not a git repository");
  }
  if (paths.length === 0) {
    await g.reset(["HEAD"]);
    return;
  }
  await g.reset(["HEAD", "--", ...paths]);
}

export async function gitCommit(
  projectPath: string,
  message: string,
): Promise<{ commit: string }> {
  assertNotPlaytesting("commit");
  const trimmed = message.trim();
  if (!trimmed) {
    throw new Error("Commit message is required");
  }
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    throw new Error("Not a git repository");
  }
  const result = await g.commit(trimmed);
  return { commit: result.commit || "" };
}

export async function gitBranches(
  projectPath: string,
): Promise<{ current: string | null; all: string[] }> {
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    return { current: null, all: [] };
  }
  const summary = await g.branchLocal();
  return { current: summary.current, all: summary.all };
}

export async function gitCheckout(
  projectPath: string,
  branch: string,
): Promise<void> {
  assertNotPlaytesting("checkout");
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    throw new Error("Not a git repository");
  }
  await g.checkout(branch);
}

export async function gitCreateBranch(
  projectPath: string,
  branch: string,
): Promise<void> {
  assertNotPlaytesting("create branch");
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    throw new Error("Not a git repository");
  }
  await g.checkoutLocalBranch(branch);
}

export async function gitPull(projectPath: string): Promise<string> {
  assertNotPlaytesting("pull");
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    throw new Error("Not a git repository");
  }
  try {
    await g.stash(["push", "-u", "-m", "Blockforge auto-stash before pull"]);
  } catch {
    // nothing to stash
  }
  const result = await g.pull();
  return JSON.stringify(result.summary ?? result);
}

export async function gitPush(projectPath: string): Promise<string> {
  assertNotPlaytesting("push");
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    throw new Error("Not a git repository");
  }
  const result = await g.push();
  return JSON.stringify(result);
}

export async function gitDiscard(
  projectPath: string,
  paths: string[],
): Promise<void> {
  assertNotPlaytesting("discard");
  if (paths.length === 0) {
    throw new Error("Specify paths to discard");
  }
  const g = git(projectPath);
  if (!(await g.checkIsRepo())) {
    throw new Error("Not a git repository");
  }
  await g.checkout(["--", ...paths]);
}
