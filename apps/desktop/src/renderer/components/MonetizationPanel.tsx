import { useEffect, useState } from "react";
import { getBlockforgeApi } from "../lib/api";

type MonetizationPanelProps = {
  projectPath: string;
};

type ProductRow = {
  id: string;
  name: string;
  kind: "gamepass" | "developer-product";
  priceInRobux?: number;
  liveOnRoblox?: boolean;
};

export function MonetizationPanel({ projectPath }: MonetizationPanelProps) {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"gamepass" | "developer-product">(
    "developer-product",
  );
  const [price, setPrice] = useState("25");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async (): Promise<void> => {
    const list = await getBlockforgeApi().listMonetizationProducts(projectPath);
    setProducts(list);
  };

  useEffect(() => {
    void refresh().catch((err: unknown) => {
      setMessage(err instanceof Error ? err.message : String(err));
    });
  }, [projectPath]);

  const handleCreate = async (): Promise<void> => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await getBlockforgeApi().createMonetizationProduct({
        projectPath,
        name: name.trim(),
        kind,
        priceInRobux: Number(price) || 0,
      });
      if (!result.success) {
        setMessage(result.message);
      } else {
        setMessage(result.message);
        setName("");
        await refresh();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="ws-dock-lede">
        Create gamepass / developer product records via Open Cloud (when credentials allow)
        and store IDs in <code>monetization.json</code> for the agent. This is scaffolding —
        not a full economy engine.
      </p>
      <div className="field">
        <label htmlFor="product-name">Product name</label>
        <input
          id="product-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Double Coins"
        />
      </div>
      <div className="field">
        <label htmlFor="product-kind">Kind</label>
        <select
          id="product-kind"
          value={kind}
          onChange={(e) =>
            setKind(e.target.value as "gamepass" | "developer-product")
          }
        >
          <option value="developer-product">Developer product</option>
          <option value="gamepass">Game pass</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="product-price">Price (Robux)</label>
        <input
          id="product-price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
      <button
        type="button"
        className="btn"
        disabled={busy || name.trim().length === 0}
        onClick={() => void handleCreate()}
      >
        {busy ? "Creating…" : "Create product"}
      </button>
      {message ? <p style={{ marginTop: "0.75rem" }}>{message}</p> : null}
      <section className="ws-dock-section">
        <h3>Products in project</h3>
        {products.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul>
            {products.map((p) => (
              <li key={p.id}>
                <code>{p.id}</code> — {p.name} ({p.kind}
                {p.priceInRobux != null ? `, ${p.priceInRobux} R$` : ""}){" "}
                {p.liveOnRoblox === true ||
                (!p.id.startsWith("local-") && p.liveOnRoblox !== false) ? (
                  <span className="badge ok">Live on Roblox</span>
                ) : (
                  <span className="badge warning">Local only — NOT live on Roblox</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
