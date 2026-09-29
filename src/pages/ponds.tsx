import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits } from "@/lib/display";

export default function PondsPage() {
  const { world, loading, error } = useWorld(12000);
  const ponds = world?.ponds ?? [];

  return (
    <Shell>
      <main className="page">
        <div className="page-title">
          <span>HABITATS · LIVE REGISTRY</span>
          <h1>ponds</h1>
          <p>{loading ? "looking for water..." : error || "quote tokens with creatures living in them."}</p>
        </div>

        {ponds.length === 0 && !loading ? (
          <div className="empty-state">no ponds registered yet.</div>
        ) : (
          <div className="guide-grid">
            {ponds.map((pond, i) => (
              <article className="field-card" key={pond.mint}>
                <small>{"POND " + String(i + 1).padStart(3, "0")}</small>
                <div className="pond-circle">~</div>
                <h2>{"$" + (pond.symbol || "QUOTE")}</h2>
                <p>{pond.name || pond.mint}</p>
                <dl>
                  <div><dt>creatures</dt><dd>{pond.creature_count}</dd></div>
                  <div>
                    <dt>water in curves</dt>
                    <dd>{formatBaseUnits(pond.quote_reserve_base_units, pond.quote_decimals, 4)}</dd>
                  </div>
                  <div><dt>mint</dt><dd>{pond.mint.slice(0, 5)}…{pond.mint.slice(-5)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </main>
    </Shell>
  );
}
