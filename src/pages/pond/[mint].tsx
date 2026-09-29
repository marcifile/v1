import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/router";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import {
  formatBaseUnits,
  mediaUrl,
  shortAddress,
  solanaExplorerUrl,
} from "@/lib/display";

const positions = [
  { left: "16%", top: "56%" },
  { left: "34%", top: "68%" },
  { left: "52%", top: "54%" },
  { left: "70%", top: "69%" },
  { left: "84%", top: "57%" },
];

export default function PondPage() {
  const router = useRouter();
  const mint = String(router.query.mint ?? "");
  const { world, loading, error } = useWorld(10000);

  const pond = useMemo(
    () => world?.ponds.find((item) => item.mint === mint) ?? null,
    [world, mint]
  );

  const creatures = useMemo(
    () => (world?.creatures ?? []).filter((item) => item.pond_mint === mint),
    [world, mint]
  );

  if (loading && !pond) {
    return <Shell><main className="page"><div className="field-empty">walking to the pond...</div></main></Shell>;
  }

  if (!pond) {
    return (
      <Shell>
        <main className="page">
          <div className="page-title manual-title">
            <span>HABITAT INDEX</span>
            <h1>not found</h1>
            <p>{error || "this pond is not in the registry."}</p>
          </div>
        </main>
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="page pond-detail-page">
        <section className="pond-detail-hero">
          <div className="pond-detail-scene">
            <div className="specimen-sky" />
            <div className="specimen-horizon" />
            <div className="specimen-water" />

            <span className="pond-detail-label">{"LIVE HABITAT · $" + (pond.symbol || "QUOTE")}</span>

            {creatures.slice(0, positions.length).map((creature, i) => (
              <Link
                key={creature.mint}
                href={"/creature/" + creature.mint}
                className="pond-resident"
                style={positions[i]}
              >
                <span>{"$" + creature.symbol}</span>
                <img src={mediaUrl(creature.image_uri)} alt={creature.name} />
              </Link>
            ))}

            {creatures.length === 0 && (
              <div className="pond-empty">no creatures live here yet.</div>
            )}
          </div>

          <aside className="pond-detail-card">
            <div className="pond-record-heading">
              <span className="pond-record-logo"><img src={mediaUrl(pond.image_uri)} alt="" /></span>
              <div><small>HABITAT RECORD</small><h1>{"$" + (pond.symbol || "QUOTE")}</h1></div>
            </div>
            <p>{pond.name || "unnamed water"}</p>

            <dl>
              <div><dt>residents</dt><dd>{pond.creature_count}</dd></div>
              <div><dt>water in curves</dt><dd>{formatBaseUnits(pond.quote_reserve_base_units, pond.quote_decimals, 6)} {pond.symbol}</dd></div>
              <div><dt>market price</dt><dd>{pond.price_usd ? "$" + Number(pond.price_usd).toLocaleString(undefined, { maximumSignificantDigits: 6 }) : "—"}</dd></div>
              <div><dt>market liquidity</dt><dd>{pond.liquidity_usd ? "$" + Number(pond.liquidity_usd).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</dd></div>
              <div><dt>market cap</dt><dd>{pond.market_cap_usd ? "$" + Number(pond.market_cap_usd).toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}</dd></div>
              <div><dt>trading fees</dt><dd>{formatBaseUnits(pond.total_trading_quote_fee_base_units, pond.quote_decimals, 6)} {pond.symbol}</dd></div>
              <div><dt>mint</dt><dd><a href={solanaExplorerUrl("address", pond.mint)} target="_blank" rel="noreferrer">{shortAddress(pond.mint, 7)} ↗</a></dd></div>
              <div><dt>dbc config</dt><dd><a href={solanaExplorerUrl("address", pond.config)} target="_blank" rel="noreferrer">{shortAddress(pond.config, 7)} ↗</a></dd></div>
              <div><dt>decimals</dt><dd>{pond.quote_decimals}</dd></div>
            </dl>

            <Link href={"/hatch?pond=" + pond.mint} className="pond-hatch-link">
              {"HATCH INTO $" + (pond.symbol || "QUOTE") + " →"}
            </Link>
          </aside>
        </section>

        <section className="pond-resident-list">
          <header><small>FIELD COUNT</small><strong>RESIDENTS</strong></header>
          {creatures.map((creature) => (
            <Link href={"/creature/" + creature.mint} key={creature.mint} className="pond-resident-row">
              <span className="field-thumb"><img src={mediaUrl(creature.image_uri)} alt="" /></span>
              <span><strong>{"$" + creature.symbol}</strong><small>{creature.name}</small></span>
              <span><strong>{(creature.progress * 100).toFixed(2)}%</strong><small>pond depth</small></span>
              <span><strong>{formatBaseUnits(creature.total_trading_quote_fee_base_units, creature.quote_decimals, 4)} {creature.pond_symbol}</strong><small>trading fees</small></span>
              <span>{creature.migrated ? "GRADUATED" : "SWIMMING"}</span>
            </Link>
          ))}
          {creatures.length === 0 && <div className="field-empty">quiet water.</div>}
        </section>
      </main>
    </Shell>
  );
}
