import Link from "next/link";
import { useWorld } from "@/hooks/useWorld";

const positions = [
  { left: "16%", top: "35%" },
  { left: "31%", top: "54%" },
  { left: "48%", top: "31%" },
  { left: "62%", top: "58%" },
  { left: "76%", top: "37%" },
  { left: "24%", top: "70%" },
  { left: "55%", top: "72%" },
  { left: "84%", top: "65%" },
];

export function WorldFrame() {
  const { world, loading, error } = useWorld(10000);
  const creatures = world?.creatures ?? [];
  const featured = creatures[0] ?? null;

  return (
    <section className="world-wrap">
      <aside className="instrument-strip">
        <div><small>POND NO.</small><strong>{String(world?.ponds.length ?? 0).padStart(3, "0")}</strong></div>
        <div><small>HABITAT</small><strong>{error ? "murky" : "live pond"}</strong></div>
        <div><small>WATER</small><strong>{creatures.length ? "on chain" : "quiet"}</strong></div>
        <div><small>MAG</small><strong>x40</strong></div>
      </aside>

      <div className="world">
        <div className="cloud c1" />
        <div className="cloud c2" />

        <div className="featured">
          <small>CREATURE OF THE HOUR</small>
          {featured ? (
            <>
              <strong>{"$" + featured.symbol}</strong>
              <span>{Math.round(featured.progress * 10000) / 100}% pond depth</span>
            </>
          ) : (
            <>
              <strong>—</strong>
              <span>{loading ? "checking the water..." : "nothing's biting"}</span>
            </>
          )}
        </div>

        <div className="hero-copy">
          <h1>pond</h1>
          <p>coins living in other coins.</p>
          <div className="hero-actions">
            <Link href="/hatch">Hatch a creature</Link>
            <Link href="/docs">How it flows</Link>
            <Link href="/creatures">See all creatures</Link>
          </div>
        </div>

        <div className="shore shore-back" />
        <div className="water">
          {creatures.slice(0, positions.length).map((creature, i) => (
            <Link
              key={creature.mint}
              className={"creature " + (creature.migrated ? "graduating" : "swimming")}
              style={positions[i]}
              href={"/creature/" + creature.mint}
              aria-label={creature.name}
            >
              <span className="ticker">{"$" + creature.symbol}</span>
              <span className="sprite">{["●","◆","⬡","■","▲"][i % 5]}</span>
            </Link>
          ))}
          {!loading && creatures.length === 0 && (
            <div className="empty-water">quiet water · hatch the first creature</div>
          )}
          <div className="lily l1" />
          <div className="lily l2" />
          <div className="reeds r1" />
          <div className="reeds r2" />
        </div>
      </div>
    </section>
  );
}
