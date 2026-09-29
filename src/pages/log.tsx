import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { shortAddress } from "@/lib/display";

export default function LogPage() {
  const { world, loading, error } = useWorld(8000);
  const events = world?.events ?? [];
  const creatures = world?.creatures ?? [];

  return (
    <Shell>
      <main className="page log-page">
        <div className="page-title manual-title">
          <span>FIELD TAPE · INDEXER</span>
          <h1>log</h1>
          <p>{loading ? "rewinding tape..." : error || "every ripple the station has recorded."}</p>
        </div>

        <div className="event-tape">
          <div className="tape-head"><span>TIME</span><span>EVENT</span><span>SPECIMEN</span><span>TX / DETAIL</span></div>
          {events.map((event) => {
            const creature = creatures.find((c) => c.mint === event.creature_mint);
            return (
              <div className="tape-row" key={event.id}>
                <time>{new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                <strong>{event.type.toUpperCase()}</strong>
                <span>{creature ? "$" + creature.symbol : event.creature_mint ? shortAddress(event.creature_mint, 4) : "SYSTEM"}</span>
                <span>{event.tx_signature ? shortAddress(event.tx_signature, 7) : event.amount_in || "indexed"}</span>
              </div>
            );
          })}
          {!loading && events.length === 0 && <div className="field-empty">no ripples recorded yet.</div>}
        </div>
      </main>
    </Shell>
  );
}
