import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits } from "@/lib/display";

export default function StatsPage() {
  const { world, loading, error } = useWorld(10000);
  const ponds = world?.ponds ?? [];
  const creatures = world?.creatures ?? [];
  const events = world?.events ?? [];

  return (
    <Shell>
      <main className="page stats-page">
        <div className="page-title manual-title">
          <span>FIELD STATION · LIVE READOUT</span>
          <h1>stats</h1>
          <p>{loading ? "counting ripples..." : error || "what the pond has seen."}</p>
        </div>

        <div className="readout-grid">
          <div><small>PONDS</small><strong>{ponds.length}</strong><span>registered habitats</span></div>
          <div><small>CREATURES</small><strong>{creatures.length}</strong><span>known specimens</span></div>
          <div><small>RIPPLES</small><strong>{events.length}</strong><span>recent indexed events</span></div>
          <div><small>GRADUATED</small><strong>{creatures.filter((c) => c.migrated).length}</strong><span>made it to deeper water</span></div>
        </div>

        <section className="station-panel">
          <header><small>POND TELEMETRY</small><strong>LIVE HABITATS</strong></header>
          {ponds.map((pond) => (
            <div className="telemetry-row" key={pond.mint}>
              <span>{"$" + (pond.symbol || "QUOTE")}</span>
              <span>{pond.creature_count} creatures</span>
              <span>{formatBaseUnits(pond.quote_reserve_base_units, pond.quote_decimals, 4)} water</span>
              <span>DBC CONNECTED</span>
            </div>
          ))}
        </section>
      </main>
    </Shell>
  );
}
