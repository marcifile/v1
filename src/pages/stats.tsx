import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";

export default function StatsPage() {
  const { world, loading, error } = useWorld(10000);
  const ponds = world?.ponds ?? [];
  const creatures = world?.creatures ?? [];
  const events = world?.events ?? [];

  return (
    <Shell>
      <main className="page">
        <div className="page-title">
          <span>READOUT · LIVE DATABASE + CHAIN SNAPSHOTS</span>
          <h1>stats</h1>
          <p>{loading ? "counting ripples..." : error || "what the pond has seen."}</p>
        </div>
        <div className="stat-grid">
          <div><small>PONDS</small><strong>{ponds.length}</strong></div>
          <div><small>CREATURES</small><strong>{creatures.length}</strong></div>
          <div><small>EVENTS</small><strong>{events.length}</strong></div>
          <div><small>GRADUATED</small><strong>{creatures.filter((c) => c.migrated).length}</strong></div>
        </div>
      </main>
    </Shell>
  );
}
