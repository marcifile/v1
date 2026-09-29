import Link from "next/link";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits } from "@/lib/display";

export default function CreaturesPage() {
  const { world, loading, error } = useWorld(10000);
  const creatures = world?.creatures ?? [];

  return (
    <Shell>
      <main className="page">
        <div className="page-title">
          <span>FIELD GUIDE · READ FROM POND</span>
          <h1>creatures</h1>
          <p>{loading ? "checking the water..." : error || "everything currently swimming."}</p>
        </div>

        <div className="tabs">
          <button>New</button>
          <button>Deep Ponds</button>
          <button>Near Graduation</button>
          <button>Mine</button>
        </div>

        {creatures.length === 0 && !loading ? (
          <div className="empty-state">nothing's swimming yet.</div>
        ) : (
          <div className="guide-grid">
            {creatures.map((c, i) => (
              <Link className="field-card" key={c.mint} href={"/creature/" + c.mint}>
                <small>{"NO. " + String(i + 1).padStart(4, "0")}</small>
                <div className="field-sprite">{["●","◆","⬡","■","▲"][i % 5]}</div>
                <h2>{"$" + c.symbol}</h2>
                <p>{"living in $" + (c.pond_symbol ?? "?")}</p>
                <dl>
                  <div>
                    <dt>water</dt>
                    <dd>
                      {formatBaseUnits(c.quote_reserve_base_units, c.quote_decimals, 4)}{" "}
                      {c.pond_symbol}
                    </dd>
                  </div>
                  <div><dt>depth</dt><dd>{(c.progress * 100).toFixed(2)}%</dd></div>
                  <div><dt>state</dt><dd>{c.migrated ? "graduated" : "bonding"}</dd></div>
                  <div><dt>pool</dt><dd>{c.pool.slice(0, 5)}…{c.pool.slice(-5)}</dd></div>
                </dl>
              </Link>
            ))}
          </div>
        )}
      </main>
    </Shell>
  );
}
