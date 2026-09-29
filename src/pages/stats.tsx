import { Shell } from "@/components/Shell";
import { creatures, ponds } from "@/lib/mock";

export default function StatsPage() {
  return (
    <Shell>
      <main className="page">
        <div className="page-title"><span>READOUT</span><h1>stats</h1><p>chain-backed counters will land after the DBC integration.</p></div>
        <div className="stat-grid">
          <div><small>PONDS</small><strong>{ponds.length}</strong></div>
          <div><small>CREATURES</small><strong>{creatures.length}</strong></div>
          <div><small>ACTIVE</small><strong>{creatures.filter((c) => c.state !== "sleeping").length}</strong></div>
          <div><small>GRADUATED</small><strong>0</strong></div>
        </div>
      </main>
    </Shell>
  );
}
