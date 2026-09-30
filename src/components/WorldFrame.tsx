import Link from "next/link";
import { useMemo } from "react";
import { useWorld } from "@/hooks/useWorld";
import { mediaUrl } from "@/lib/display";
import type { WorldCreature } from "@/types/world";

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

function safeBigInt(value: string | null | undefined) {
  try {
    return BigInt(value || "0");
  } catch {
    return 0n;
  }
}

export function WorldFrame() {
  const { world, loading } = useWorld(10000);
  const creatures = world?.creatures ?? [];
  const ponds = world?.ponds ?? [];

  const pondTotals = useMemo(() => {
    const totals = new Map<string, bigint>();
    for (const creature of creatures) {
      totals.set(
        creature.pond_mint,
        (totals.get(creature.pond_mint) || 0n) +
          safeBigInt(creature.quote_reserve_base_units)
      );
    }
    return totals;
  }, [creatures]);

  const weight = (creature: WorldCreature) => {
    const reserve = safeBigInt(creature.quote_reserve_base_units);
    const total = pondTotals.get(creature.pond_mint) || 0n;
    if (reserve <= 0n || total <= 0n) return 0;
    return Number((reserve * 10000n) / total) / 100;
  };

  const featured = creatures[0] ?? null;

  return (
    <section className="world-console">
      <aside className="instrument-strip">
        <div><small>WORLD</small><strong>MAIN p0nd</strong></div>
        <div><small>PONDS</small><strong>{ponds.length}</strong></div>
        <div><small>CREATURES</small><strong>{creatures.length}</strong></div>
        <div><small>VIEW</small><strong>ALL HABITATS</strong></div>
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
          <i /> MAIN p0nd <span>ALL PONDS · READ FROM CHAIN</span>
        </div>

        {ponds.length > 0 && (
          <div className="world-pond-tabs" aria-label="Open a pond habitat">
            <span className="active"><strong>ALL</strong><small>{creatures.length}</small></span>
            {ponds.slice(0, 6).map((pond) => (
              <Link key={pond.mint} href={"/pond/" + pond.mint}>
                <strong>{"$" + (pond.symbol || "QUOTE")}</strong>
                <small>{pond.creature_count}</small>
              </Link>
            ))}
            <Link href="/ponds">ALL PONDS →</Link>
          </div>
        )}

        <div className="featured">
          <small>LATEST CREATURE · ANY POND</small>
          {featured ? (
            <>
              <strong>{"$" + featured.symbol}</strong>
              <span>
                {weight(featured).toFixed(2) + "% weight in $" + (featured.pond_symbol || "POND")}
              </span>
            </>
          ) : (
            <>
              <strong>—</strong>
              <span>{loading ? "checking the reeds..." : "nothing's biting"}</span>
            </>
          )}
        </div>

        <div className="hero-copy">
          <div className="hero-kicker">{ponds.length + " PONDS · ONE MAIN p0nd"}</div>
          <h1>p0nd</h1>
          <p>every creature, across every pond.</p>
          <div className="hero-actions">
            <Link href="/hatch">Hatch a creature</Link>
            <Link href="/ponds/new">Open a pond</Link>
            <Link href="/ponds">Browse ponds <b>{ponds.length}</b></Link>
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
              <small>
                {weight(creature).toFixed(2) + "% · $" + (creature.pond_symbol || "POND")}
              </small>
            </Link>
          ))}
        </div>

        {!loading && creatures.length === 0 && (
          <div className="empty-water">
            the main p0nd is quiet · <Link href="/hatch">hatch the first creature</Link>
          </div>
        )}

        <div className="world-legend">
          <span><i className="legend-new" /> WEIGHT</span>
          <strong>
            each creature&apos;s share of the indexed quote reserve inside its own pond
          </strong>
        </div>
      </div>

      {creatures.length > 0 && (
        <div className="pond-resident-list main-pond-ledger">
          <header>
            <small>ALL PONDS TOGETHER</small>
            <strong>CREATURE WEIGHTS</strong>
          </header>
          {creatures.map((creature) => (
            <Link
              href={"/creature/" + creature.mint}
              key={creature.mint}
              className="pond-resident-row"
            >
              <span className="field-thumb"><img src={mediaUrl(creature.image_uri)} alt="" /></span>
              <span><strong>{"$" + creature.symbol}</strong><small>{creature.name}</small></span>
              <span><strong>{"$" + (creature.pond_symbol || "POND")}</strong><small>pond</small></span>
              <span><strong>{weight(creature).toFixed(2) + "%"}</strong><small>weight in its pond</small></span>
              <span>{creature.migrated ? "GRADUATED" : "SWIMMING"}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
