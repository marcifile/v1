import Link from "next/link";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits, mediaUrl } from "@/lib/display";

const positions = [
  { left: "12%", top: "55%" },
  { left: "28%", top: "68%" },
  { left: "45%", top: "51%" },
  { left: "61%", top: "70%" },
  { left: "76%", top: "57%" },
  { left: "20%", top: "80%" },
  { left: "52%", top: "82%" },
  { left: "84%", top: "76%" },
];

export function WorldFrame() {
  const { world, loading, error } = useWorld(10000);
  const creatures = world?.creatures ?? [];
  const ponds = world?.ponds ?? [];
  const featured = creatures[0] ?? null;
  const primaryPond = ponds[0] ?? null;

  const waterTotal = primaryPond
    ? formatBaseUnits(
        primaryPond.quote_reserve_base_units,
        primaryPond.quote_decimals,
        2
      )
    : "0";

  return (
    <section className="world-console">
      <aside className="instrument-strip">
        <div><small>SLIDE NO.</small><strong>{String(creatures.length || 1).padStart(3, "0")}</strong></div>
        <div><small>SPECIMEN</small><strong>{error ? "murky" : "live colony"}</strong></div>
        <div><small>WATER</small><strong>{waterTotal} {primaryPond?.symbol ?? ""}</strong></div>
        <div><small>MAG</small><strong>x40</strong></div>
        <div className="instrument-scale" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => <i key={i} />)}
        </div>
      </aside>

      <div className="world">
        <div className="pixel-sky" />
        <div className="pixel-horizon" />
        <div className="pixel-rays" />
        <div className="pixel-water-depth" />
        <div className="world-shimmer" />

        <div className="world-live-tag">
          <i /> LIVE COLONY <span>READ FROM CHAIN</span>
        </div>

        <div className="featured">
          <small>CREATURE OF THE HOUR</small>
          {featured ? (
            <>
              <strong>{"$" + featured.symbol}</strong>
              <span>{(featured.progress * 100).toFixed(2)}% pond depth</span>
            </>
          ) : (
            <>
              <strong>—</strong>
              <span>{loading ? "checking the reeds..." : "nothing's biting"}</span>
            </>
          )}
        </div>

        <div className="hero-copy">
          <div className="hero-kicker">WELCOME TO</div>
          <h1>pond</h1>
          <p>launch real coins priced in other coins.</p>
          <div className="hero-actions">
            <Link href="/hatch">Hatch a creature</Link>
            <Link href="/docs">How it flows</Link>
            <Link href="/creatures">See all creatures <b>{creatures.length}</b></Link>
          </div>
        </div>

        <div className="world-creatures">
          {creatures.slice(0, positions.length).map((creature, i) => (
            <Link
              key={creature.mint}
              className={"world-creature " + (creature.migrated ? "graduating" : "swimming")}
              style={positions[i]}
              href={"/creature/" + creature.mint}
              aria-label={creature.name}
            >
              <span className="ticker">{"$" + creature.symbol}</span>
              <span className="world-creature-art">
                <img src={mediaUrl(creature.image_uri)} alt="" />
              </span>
              <small>{"$" + (creature.pond_symbol ?? "QUOTE")}</small>
            </Link>
          ))}
        </div>

        {!loading && creatures.length === 0 && (
          <div className="empty-water">
            quiet water · <Link href="/hatch">hatch the first creature</Link>
          </div>
        )}

        <div className="world-legend">
          <span><i className="legend-new" /> NEW</span>
          <span><i className="legend-busy" /> SWIMMING</span>
          <span><i className="legend-deep" /> DEEP WATER</span>
        </div>
      </div>
    </section>
  );
}
