import Link from "next/link";
import { creatures } from "@/lib/mock";

export function WorldFrame() {
  const featured = creatures[0];
  return (
    <section className="world-wrap">
      <aside className="instrument-strip">
        <div><small>POND NO.</small><strong>001</strong></div>
        <div><small>HABITAT</small><strong>live pond</strong></div>
        <div><small>WATER</small><strong>quote</strong></div>
        <div><small>MAG</small><strong>x40</strong></div>
      </aside>

      <div className="world">
        <div className="cloud c1" />
        <div className="cloud c2" />
        <div className="featured">
          <small>CREATURE OF THE HOUR</small>
          <strong>{"$" + featured.symbol}</strong>
          <span>{featured.trades1h} swims in the last hour</span>
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
          {creatures.map((creature, i) => (
            <Link
              key={creature.mint}
              className={"creature creature-" + (i + 1) + " " + creature.state}
              href={"/creature/" + creature.mint}
              aria-label={creature.name}
            >
              <span className="ticker">{"$" + creature.symbol}</span>
              <span className="sprite">{creature.species === "frog" ? "●" : creature.species === "fish" ? "◆" : "⬡"}</span>
            </Link>
          ))}
          <div className="lily l1" />
          <div className="lily l2" />
          <div className="reeds r1" />
          <div className="reeds r2" />
        </div>
      </div>
    </section>
  );
}
