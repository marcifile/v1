import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { shortAddress, solanaExplorerUrl } from "@/lib/display";

export default function LogPage() {
  const { world, loading, error } = useWorld(8000);
  const events = world?.events ?? [];
  const creatures = world?.creatures ?? [];
  const ponds = world?.ponds ?? [];

  return (
    <Shell>
      <main className="page log-page">
        <div className="page-title manual-title">
          <span>FIELD TAPE · INDEXER</span>
          <h1>log</h1>
          <p>
            {loading
              ? "rewinding tape..."
              : error || "indexed ripples with chain links when a transaction exists."}
          </p>
        </div>

        <div className="event-tape">
          <div className="tape-head">
            <span>TIME</span><span>EVENT</span><span>SPECIMEN</span><span>DETAIL / TX</span>
          </div>

          {events.map((event) => {
            const creature = creatures.find(
              (item) => item.mint === event.creature_mint
            );
            const pond = ponds.find((item) => item.mint === event.pond_mint);
            const pondSymbol = pond?.symbol || creature?.pond_symbol || "QUOTE";

            let detail = "indexed from chain";
            if (event.type === "buy") {
              detail =
                (event.amount_in || "?") +
                " " +
                pondSymbol +
                " → " +
                (event.amount_out || "?") +
                " " +
                (creature?.symbol || "CREATURE");
            } else if (event.type === "sell") {
              detail =
                (event.amount_in || "?") +
                " " +
                (creature?.symbol || "CREATURE") +
                " → " +
                (event.amount_out || "?") +
                " " +
                pondSymbol;
            } else if (event.type === "claim_creator_fee") {
              detail =
                (event.amount_out || "?") +
                " " +
                pondSymbol +
                " creator fees claimed";
            } else if (event.type === "launch") {
              detail = "new DBC market registered";
            } else if (event.type === "graduation") {
              detail = "curve reached deeper water";
            } else if (event.type === "water_change") {
              detail = "quote reserve changed on chain";
            }

            return (
              <div className="tape-row" key={event.id}>
                <time>
                  {new Date(event.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </time>
                <strong>{event.type.replaceAll("_", " ").toUpperCase()}</strong>
                <span>
                  {creature
                    ? "$" + creature.symbol
                    : event.creature_mint
                    ? shortAddress(event.creature_mint, 4)
                    : "SYSTEM"}
                </span>
                <span className="tape-detail">
                  {detail}
                  {event.tx_signature && (
                    <a
                      href={solanaExplorerUrl("tx", event.tx_signature)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortAddress(event.tx_signature, 6)} ↗
                    </a>
                  )}
                </span>
              </div>
            );
          })}

          {!loading && events.length === 0 && (
            <div className="field-empty">no ripples recorded yet.</div>
          )}
        </div>
      </main>
    </Shell>
  );
}
