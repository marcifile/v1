import Head from "next/head";
import { Shell } from "@/components/Shell";
import { WorldFrame } from "@/components/WorldFrame";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits } from "@/lib/display";

export default function Home() {
  const { world } = useWorld(10000);
  const ponds = world?.ponds ?? [];
  const creatures = world?.creatures ?? [];
  const events = world?.events ?? [];
  const primaryPond = ponds[0];

  const latest = events[0];
  const latestText = latest
    ? latest.type + (latest.creature_mint ? " · " + latest.creature_mint.slice(0, 5) + "…" : "")
    : "waiting for a ripple";

  const waterText = primaryPond
    ? formatBaseUnits(
        primaryPond.quote_reserve_base_units,
        primaryPond.quote_decimals,
        2
      ) + " " + (primaryPond.symbol || "quote")
    : "0";

  return (
    <>
      <Head>
        <title>pond — coins living in other coins</title>
        <meta name="description" content="Coins living in other coins." />
      </Head>
      <Shell>
        <main className="home">
          <WorldFrame />
          <footer className="statusbar">
            <div><small>PONDS</small><strong>{ponds.length}</strong></div>
            <div><small>CREATURES</small><strong>{creatures.length}</strong></div>
            <div><small>WATER</small><strong>{waterText}</strong></div>
            <div><small>ACTIVE</small><strong>{creatures.filter((c) => !c.migrated).length}</strong></div>
            <div className="wide"><small>SOLANA</small><strong>devnet · read from chain</strong></div>
            <div className="wide"><small>LATEST</small><strong>{latestText}</strong></div>
          </footer>
        </main>
      </Shell>
    </>
  );
}
