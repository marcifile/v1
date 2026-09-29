import Link from "next/link";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits, shortAddress } from "@/lib/display";

export default function StatsPage() {
  const { world, loading, error } = useWorld(10000);
  const ponds = world?.ponds ?? [];
  const creatures = world?.creatures ?? [];
  const events = world?.events ?? [];

  const graduated = creatures.filter((c) => c.migrated).length;
  const avgDepth = creatures.length
    ? creatures.reduce((sum, creature) => sum + creature.progress, 0) /
      creatures.length
    : 0;

  const activity = {
    launch: events.filter((event) => event.type === "launch").length,
    buy: events.filter((event) => event.type === "buy").length,
    sell: events.filter((event) => event.type === "sell").length,
    water: events.filter((event) => event.type === "water_change").length,
  };

  const maxResidents = Math.max(
    1,
    ...ponds.map((pond) => Number(pond.creature_count || 0))
  );

  return (
    <Shell>
      <main className="page stats-page">
        <div className="page-title manual-title">
          <span>FIELD STATION · LIVE READOUT</span>
          <h1>stats</h1>
          <p>
            {loading
              ? "counting ripples..."
              : error || "a live instrument panel for the whole ecosystem."}
          </p>
        </div>

        <div className="readout-grid">
          <div><small>PONDS</small><strong>{ponds.length}</strong><span>registered quote-token habitats</span></div>
          <div><small>CREATURES</small><strong>{creatures.length}</strong><span>real Solana SPL launches</span></div>
          <div><small>AVG DEPTH</small><strong>{(avgDepth * 100).toFixed(2)}%</strong><span>average curve progress</span></div>
          <div><small>GRADUATED</small><strong>{graduated}</strong><span>made it to deeper water</span></div>
        </div>

        <div className="station-layout">
          <section className="station-panel">
            <header><small>POND TELEMETRY</small><strong>LIVE HABITATS</strong></header>
            {ponds.map((pond) => (
              <Link href={"/pond/" + pond.mint} className="telemetry-card" key={pond.mint}>
                <div className="telemetry-main">
                  <span className="telemetry-symbol">{"$" + (pond.symbol || "QUOTE")}</span>
                  <span>{pond.name || "unnamed pond"}</span>
                </div>
                <div className="telemetry-water">
                  <small>WATER IN CURVES</small>
                  <strong>{formatBaseUnits(pond.quote_reserve_base_units, pond.quote_decimals, 4)} {pond.symbol}</strong>
                </div>
                <div className="telemetry-fees">
                  <small>TRADING FEES</small>
                  <strong>{formatBaseUnits(pond.total_trading_quote_fee_base_units, pond.quote_decimals, 4)} {pond.symbol}</strong>
                </div>
                <div className="telemetry-residents">
                  <small>RESIDENTS</small>
                  <strong>{pond.creature_count}</strong>
                  <span className="telemetry-meter">
                    <i style={{ width: Math.max(5, (Number(pond.creature_count || 0) / maxResidents) * 100) + "%" }} />
                  </span>
                </div>
                <div className="telemetry-link">
                  <small>MINT</small>
                  <strong>{shortAddress(pond.mint, 5)}</strong>
                </div>
              </Link>
            ))}
            {!loading && ponds.length === 0 && <div className="field-empty">no habitats yet.</div>}
          </section>

          <section className="station-panel activity-meter-panel">
            <header><small>RIPPLE MIX</small><strong>RECENT EVENTS</strong></header>
            <div className="activity-meters">
              <div><span>LAUNCHES</span><strong>{activity.launch}</strong><i><b style={{ width: Math.min(100, activity.launch * 18) + "%" }} /></i></div>
              <div><span>BUYS</span><strong>{activity.buy}</strong><i><b style={{ width: Math.min(100, activity.buy * 18) + "%" }} /></i></div>
              <div><span>SELLS</span><strong>{activity.sell}</strong><i><b style={{ width: Math.min(100, activity.sell * 18) + "%" }} /></i></div>
              <div><span>WATER CHANGES</span><strong>{activity.water}</strong><i><b style={{ width: Math.min(100, activity.water * 10) + "%" }} /></i></div>
            </div>
          </section>
        </div>

        <section className="depth-board">
          <header>
            <div><small>SPECIMEN DEPTH</small><strong>WHO&apos;S CLOSEST TO DEEPER WATER?</strong></div>
            <Link href="/creatures">OPEN FIELD GUIDE →</Link>
          </header>
          <div className="depth-list">
            {creatures
              .slice()
              .sort((a, b) => b.progress - a.progress)
              .slice(0, 8)
              .map((creature) => (
                <Link href={"/creature/" + creature.mint} key={creature.mint} className="depth-row">
                  <span><strong>{"$" + creature.symbol}</strong><small>{"in $" + (creature.pond_symbol || "QUOTE")}</small></span>
                  <span className="depth-track"><i style={{ width: Math.min(100, creature.progress * 100) + "%" }} /></span>
                  <strong>{(creature.progress * 100).toFixed(2)}%</strong>
                </Link>
              ))}
            {!loading && creatures.length === 0 && <div className="field-empty">no specimens yet.</div>}
          </div>
        </section>
      </main>
    </Shell>
  );
}
