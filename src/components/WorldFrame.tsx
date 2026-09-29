import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const allCreatures = world?.creatures ?? [];
  const ponds = world?.ponds ?? [];
  const [activeMint, setActiveMint] = useState("all");

  useEffect(() => {
    if (!ponds.length) {
      setActiveMint("all");
      return;
    }
    if (
      activeMint !== "all" &&
      !ponds.some((pond) => pond.mint === activeMint)
    ) {
      setActiveMint("all");
    }
  }, [ponds, activeMint]);

  const activePond = useMemo(
    () =>
      activeMint === "all"
        ? null
        : ponds.find((pond) => pond.mint === activeMint) ?? null,
    [ponds, activeMint]
  );

  const creatures = useMemo(
    () =>
      activePond
        ? allCreatures.filter(
            (creature) => creature.pond_mint === activePond.mint
          )
        : allCreatures,
    [allCreatures, activePond]
  );

  const featured = creatures[0] ?? null;
  const waterTotal = activePond
    ? formatBaseUnits(
        activePond.quote_reserve_base_units,
        activePond.quote_decimals,
        2
      )
    : "mixed";

  return (
    <section className="world-console">
      <aside className="instrument-strip">
        <div>
          <small>POND NO.</small>
          <strong>
            {activePond
              ? String(
                  Math.max(
                    1,
                    ponds.findIndex((pond) => pond.mint === activePond.mint) + 1
                  )
                ).padStart(3, "0")
              : ponds.length + " TOTAL"}
          </strong>
        </div>
        <div>
          <small>HABITAT</small>
          <strong>{activePond ? "$" + (activePond.symbol || "QUOTE") : "ALL PONDS"}</strong>
        </div>
        <div>
          <small>RESIDENTS</small>
          <strong>{creatures.length}</strong>
        </div>
        <div>
          <small>WATER</small>
          <strong>
            {activePond ? waterTotal + " " + (activePond.symbol ?? "") : "mixed quote assets"}
          </strong>
        </div>
        <div className="instrument-scale" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <i key={i} />
          ))}
        </div>
      </aside>

      <div className="world">
        <div className="pixel-sky" />
        <div className="pixel-horizon" />
        <div className="pixel-rays" />
        <div className="pixel-water-depth" />
        <div className="world-shimmer" />

        <div className="world-live-tag">
          <i /> LIVE HABITAT <span>READ FROM CHAIN</span>
        </div>

        {ponds.length > 0 && (
          <div className="world-pond-tabs" aria-label="Choose pond habitat">
            <button
              type="button"
              className={activeMint === "all" ? "active" : ""}
              onClick={() => setActiveMint("all")}
            >
              <strong>ALL</strong>
              <small>{allCreatures.length}</small>
            </button>
            {ponds.slice(0, 6).map((pond) => (
              <button
                key={pond.mint}
                type="button"
                className={
                  pond.mint === activePond?.mint ? "active" : ""
                }
                onClick={() => setActiveMint(pond.mint)}
              >
                <strong>{"$" + (pond.symbol || "QUOTE")}</strong>
                <small>{pond.creature_count}</small>
              </button>
            ))}
            <Link href="/ponds">ALL PONDS →</Link>
          </div>
        )}

        <div className="featured">
          <small>{activePond ? "CREATURE OF THIS POND" : "LATEST CREATURE"}</small>
          {featured ? (
            <>
              <strong>{"$" + featured.symbol}</strong>
              <span>{(featured.progress * 100).toFixed(2)}% pond depth</span>
            </>
          ) : (
            <>
              <strong>—</strong>
              <span>
                {loading ? "checking the reeds..." : "nothing's biting"}
              </span>
            </>
          )}
        </div>

        <div className="hero-copy">
          <div className="hero-kicker">
            {activePond
              ? "$" + (activePond.symbol || "QUOTE") + " POND"
              : ponds.length + " PONDS · ONE WORLD"}
          </div>
          <h1>p0nd</h1>
          <p>launch real coins priced in other coins.</p>
          <div className="hero-actions">
            <Link
              href={
                activePond ? "/hatch?pond=" + activePond.mint : "/ponds/new"
              }
            >
              {activePond ? "Hatch a creature" : "Open a pond"}
            </Link>
            <Link href="/docs">How it flows</Link>
            <Link href="/creatures">
              See all creatures <b>{allCreatures.length}</b>
            </Link>
          </div>
        </div>

        <div className="world-creatures">
          {creatures.slice(0, positions.length).map((creature, i) => (
            <Link
              key={creature.mint}
              className={
                "world-creature " +
                (creature.migrated ? "graduating" : "swimming")
              }
              style={positions[i]}
              href={"/creature/" + creature.mint}
              aria-label={creature.name}
            >
              <span className="ticker">{"$" + creature.symbol}</span>
              <span className="world-creature-art">
                <img src={mediaUrl(creature.image_uri)} alt="" />
              </span>
              <small>
                {"in $" + (creature.pond_symbol ?? "QUOTE")}
              </small>
            </Link>
          ))}
        </div>

        {!loading && activePond && creatures.length === 0 && (
          <div className="empty-water">
            quiet water ·{" "}
            <Link href={"/hatch?pond=" + activePond.mint}>
              hatch the first creature here
            </Link>
          </div>
        )}

        {!loading && ponds.length === 0 && (
          <div className="empty-water">
            no ponds yet · <Link href="/ponds/new">open the first pond</Link>
          </div>
        )}

        <div className="world-legend">
          <span>
            <i className="legend-new" /> POND
          </span>
          <strong>
            {activePond
              ? "$" +
                (activePond.symbol || "QUOTE") +
                " is the currency for every creature shown here"
              : "all habitats together · each creature keeps its own pond currency"}
          </strong>
        </div>
      </div>
    </section>
  );
}
