import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits, shortAddress } from "@/lib/display";

type LiveStatus = {
  quoteReserve: string;
  migrationQuoteThreshold: string;
  progressPercent: number;
  isMigrated: boolean;
  updatedAt: string;
};

export default function CreaturePage() {
  const router = useRouter();
  const id = String(router.query.id ?? "");
  const { world, loading, error } = useWorld(10000);
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [liveError, setLiveError] = useState("");

  const creature = useMemo(
    () => world?.creatures.find((c) => c.mint === id) ?? null,
    [world, id]
  );

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(
          "/api/dbc/status?baseMint=" + encodeURIComponent(id),
          { cache: "no-store" }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "status read failed.");
        }
        if (!cancelled) {
          setLive(data as LiveStatus);
          setLiveError("");
        }
      } catch (err) {
        if (!cancelled) {
          setLiveError(
            err instanceof Error ? err.message : "can't see through the water."
          );
        }
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [id]);

  if (loading && !creature) {
    return (
      <Shell>
        <main className="page"><div className="empty-state">checking the water...</div></main>
      </Shell>
    );
  }

  if (!creature) {
    return (
      <Shell>
        <main className="page">
          <div className="page-title">
            <span>FIELD GUIDE</span>
            <h1>not found</h1>
            <p>{error || "this creature is not in the POND registry yet."}</p>
          </div>
        </main>
      </Shell>
    );
  }

  const progressPercent =
    live?.progressPercent ?? Math.round(creature.progress * 10000) / 100;
  const water =
    live?.quoteReserve ??
    formatBaseUnits(
      creature.quote_reserve_base_units,
      creature.quote_decimals,
      6
    );
  const threshold =
    live?.migrationQuoteThreshold ??
    formatBaseUnits(
      creature.migration_threshold_base_units,
      creature.quote_decimals,
      6
    );

  return (
    <Shell>
      <main className="page">
        <div className="creature-room">
          <div className="room-scene">
            <span className="room-label">
              {"POND / $" + (creature.pond_symbol ?? "QUOTE")}
            </span>
            <div className="big-sprite">●</div>
            <h1>{"$" + creature.symbol}</h1>
            <p>{"living in $" + (creature.pond_symbol ?? "?")}</p>
          </div>

          <div className="room-data">
            <div>
              <small>WATER / QUOTE RESERVE</small>
              <strong>{water} {creature.pond_symbol}</strong>
            </div>
            <div>
              <small>GRADUATES AT</small>
              <strong>{threshold} {creature.pond_symbol}</strong>
            </div>
            <div>
              <small>GRADUATION</small>
              <strong>{progressPercent}%</strong>
            </div>
            <div>
              <small>POOL</small>
              <strong>{shortAddress(creature.pool, 7)}</strong>
            </div>
            <div>
              <small>CREATOR</small>
              <strong>{shortAddress(creature.creator, 7)}</strong>
            </div>
            <div className="meter">
              <span style={{ width: Math.max(0, Math.min(100, progressPercent)) + "%" }} />
            </div>
            <p className="muted">
              {liveError
                ? "live read delayed · " + liveError
                : live?.isMigrated
                ? "graduated into deeper water."
                : "live · read from chain"}
            </p>
          </div>
        </div>
      </main>
    </Shell>
  );
}
