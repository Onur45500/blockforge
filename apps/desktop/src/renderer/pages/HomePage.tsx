import { useCallback, useEffect, useState } from "react";
import type {
  ProjectCreateProgressEvent,
  ProjectSummary,
} from "../../shared/ipc-types";
import { CURRENT_TEMPLATE_VERSION } from "../../shared/template-version";
import { getBlockforgeApi } from "../lib/api";

function isOutdated(version: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  };
  const a = parse(version);
  const b = parse(CURRENT_TEMPLATE_VERSION);
  for (let i = 0; i < 3; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av !== bv) return av < bv;
  }
  return false;
}

const CREATE_STEPS: Array<ProjectCreateProgressEvent["step"]> = [
  "copy",
  "npm-install",
  "typecheck",
];

const STEP_LABELS: Record<ProjectCreateProgressEvent["step"], string> = {
  copy: "Copy template",
  "npm-install": "Install dependencies",
  typecheck: "Typecheck",
  done: "Done",
};

type HomePageProps = {
  onOpenProject: (id: string) => Promise<void>;
};

export function HomePage({ onOpenProject }: HomePageProps) {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createStep, setCreateStep] = useState<
    ProjectCreateProgressEvent["step"] | null
  >(null);
  const [createDetail, setCreateDetail] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await getBlockforgeApi().listProjects();
    setProjects(list);
  }, []);

  useEffect(() => {
    void refresh().catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [refresh]);

  useEffect(() => {
    return getBlockforgeApi().onProjectCreateProgress((event) => {
      setCreateStep(event.step);
      setCreateDetail(event.detail);
    });
  }, []);

  const handleCreate = async (): Promise<void> => {
    setError(null);
    setLoading(true);
    setCreateStep("copy");
    setCreateDetail("Starting…");
    try {
      const created = await getBlockforgeApi().createProject(name);
      setName("");
      await refresh();
      await onOpenProject(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
      setCreateStep(null);
      setCreateDetail(null);
    }
  };

  return (
    <div>
      <p className="muted" style={{ marginTop: 0, marginBottom: "1.25rem" }}>
        Open a project to enter the agent workspace.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>New project</h3>
        <div className="row">
          <input
            type="text"
            placeholder="My Roblox game"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ minWidth: "260px" }}
          />
          <button
            type="button"
            className="btn"
            disabled={loading || name.trim().length === 0}
            onClick={() => void handleCreate()}
          >
            {loading ? "Creating…" : "Create from template"}
          </button>
        </div>
        {loading && createStep ? (
          <ol className="create-progress" aria-live="polite">
            {CREATE_STEPS.map((step) => {
              const currentIdx = CREATE_STEPS.indexOf(
                createStep === "done" ? "typecheck" : createStep,
              );
              const stepIdx = CREATE_STEPS.indexOf(step);
              const done =
                createStep === "done" || (currentIdx >= 0 && stepIdx < currentIdx);
              const active = step === createStep;
              return (
                <li
                  key={step}
                  className={
                    done ? "done" : active ? "active" : undefined
                  }
                >
                  {STEP_LABELS[step]}
                  {active && createDetail ? (
                    <span className="muted"> — {createDetail}</span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : null}
        {error ? (
          <pre className="error-text create-error">{error}</pre>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Your projects</h3>
        {projects.length === 0 ? (
          <p className="muted">No projects yet. Create one to get started.</p>
        ) : (
          <ul className="list">
            {projects.map((project) => (
              <li key={project.id}>
                <div>
                  <strong>{project.name}</strong>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    Template v{project.templateVersion} ·{" "}
                    {new Date(project.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="row">
                  {isOutdated(project.templateVersion) ? (
                    <span className="badge warning">outdated</span>
                  ) : (
                    <span className="badge ok">v{project.templateVersion}</span>
                  )}
                  <button
                    type="button"
                    className="btn secondary"
                    onClick={() => void onOpenProject(project.id)}
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
