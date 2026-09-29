import Link from "next/link";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits, shortAddress } from "@/lib/display";

export default function PondsPage() {
  const { world, loading, error } = useWorld(12000);
  const ponds = world?.ponds ?? [];

  return (
    <Shell>
      <main className="page habitats-page">
        <div className="page-title manual-title">
          <span>HABITAT INDEX · LIVE REGISTRY</span>
          <h1>ponds</h1>
          <p>{loading ? "looking for water..." : error || "tokens that creatures can live in."}</p>
        </div>

        <div className="habitat-grid">
          {ponds.map((pond, i) => (
            <Link className="habitat-card" key={pond.mint} href={"/pond/" + pond.mint}>
              <div className="habitat-scene">
                <div className="habitat-sky" />
                <div className="habitat-horizon" />
                <div className="habitat-water" />
                <span className="habitat-number">POND {String(i + 1).padStart(3, "0")}</span>
                <span className="habitat-pop">{pond.creature_count} creatures</span>
              </div>
              <div className="habitat-info">
                <div>
                  <small>HABITAT</small>
                  <h2>{"$" + (pond.symbol || "QUOTE")}</h2>
                  <p>{pond.name || "unnamed water"}</p>
                </div>
                <dl>
                  <div><dt>water in curves</dt><dd>{formatBaseUnits(pond.quote_reserve_base_units, pond.quote_decimals, 4)} {pond.symbol}</dd></div>
                  <div><dt>trading fees</dt><dd>{formatBaseUnits(pond.total_trading_quote_fee_base_units, pond.quote_decimals, 4)} {pond.symbol}</dd></div>
                  <div><dt>mint</dt><dd>{shortAddress(pond.mint, 6)}</dd></div>
                  <div><dt>dbc config</dt><dd>{shortAddress(pond.config, 6)}</dd></div>
                </dl>
                <span className="habitat-action">OPEN HABITAT →</span>
              </div>
            </Link>
          ))}
        </div>

        {!loading && ponds.length === 0 && (
          <div className="field-empty">no habitats have been registered yet.</div>
        )}
      </main>
    </Shell>
  );
}
