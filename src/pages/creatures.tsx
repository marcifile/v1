import Link from "next/link";
import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits, mediaUrl, shortAddress } from "@/lib/display";

type Filter = "new" | "trending" | "deep" | "near" | "mine";

export default function CreaturesPage() {
  const { world, loading, error } = useWorld(10000);
  const { publicKey } = useWallet();
  const [filter, setFilter] = useState<Filter>("new");
  const [search, setSearch] = useState("");

  const creatures = useMemo(() => {
    const query = search.trim().toLowerCase();
    const all = [...(world?.creatures ?? [])].filter((creature) => {
      if (!query) return true;
      return (
        creature.symbol.toLowerCase().includes(query) ||
        creature.name.toLowerCase().includes(query) ||
        creature.mint.toLowerCase().includes(query) ||
        (creature.pond_symbol || "").toLowerCase().includes(query)
      );
    });

    if (filter === "mine") {
      return publicKey
        ? all.filter((c) => c.creator === publicKey.toBase58())
        : [];
    }

    if (filter === "trending") {
      const events = world?.events ?? [];
      const recentTrades = new Map<string, number>();
      for (const event of events) {
        if (
          event.creature_mint &&
          (event.type === "buy" || event.type === "sell")
        ) {
          recentTrades.set(
            event.creature_mint,
            (recentTrades.get(event.creature_mint) || 0) + 1
          );
        }
      }
      return all.sort(
        (a, b) =>
          (recentTrades.get(b.mint) || 0) -
          (recentTrades.get(a.mint) || 0)
      );
    }

    if (filter === "near") {
      return all
        .filter((c) => !c.migrated && c.progress >= 0.75)
        .sort((a, b) => b.progress - a.progress);
    }

    if (filter === "deep") {
      return all.sort((a, b) => b.progress - a.progress);
    }

    return all.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [world, filter, publicKey, search]);

  return (
    <Shell>
      <main className="page field-guide-page">
        <div className="page-title manual-title">
          <span>FIELD GUIDE · READ FROM POND</span>
          <h1>creatures</h1>
          <p>{loading ? "checking the water..." : error || "everything currently swimming."}</p>
        </div>

        <div className="filter-strip">
          <button className={filter === "new" ? "active" : ""} onClick={() => setFilter("new")}>NEW</button>
          <button className={filter === "trending" ? "active" : ""} onClick={() => setFilter("trending")}>TRENDING</button>
          <button className={filter === "deep" ? "active" : ""} onClick={() => setFilter("deep")}>DEEP PONDS</button>
          <button className={filter === "near" ? "active" : ""} onClick={() => setFilter("near")}>NEAR GRADUATION</button>
          <button className={filter === "mine" ? "active" : ""} onClick={() => setFilter("mine")}>MINE</button>
          <span>{creatures.length} SPECIMENS</span>
        </div>

        <div className="field-search">
          <label>
            <span>SEARCH</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ticker, name, pond or mint"
            />
          </label>
          <span>trending ranks by recent indexed buy/sell activity</span>
        </div>

        <div className="field-table">
          <div className="field-row field-head">
            <span>NO.</span><span>SPECIMEN</span><span>POND</span><span>WATER</span><span>DEPTH</span><span>STATE</span>
          </div>

          {creatures.map((c, i) => (
            <Link className="field-row" key={c.mint} href={"/creature/" + c.mint}>
              <span className="field-no">{String(i + 1).padStart(4, "0")}</span>
              <span className="field-identity">
                <span className="field-thumb"><img src={mediaUrl(c.image_uri)} alt="" /></span>
                <span><strong>{"$" + c.symbol}</strong><small>{c.name}</small></span>
              </span>
              <span><strong>{"$" + (c.pond_symbol ?? "QUOTE")}</strong><small>{shortAddress(c.pond_mint, 4)}</small></span>
              <span><strong>{formatBaseUnits(c.quote_reserve_base_units, c.quote_decimals, 4)}</strong><small>{c.pond_symbol}</small></span>
              <span><strong>{(c.progress * 100).toFixed(2)}%</strong><span className="mini-meter"><i style={{ width: Math.min(100, c.progress * 100) + "%" }} /></span></span>
              <span className="state-cell"><i className={c.migrated ? "state-dot deep" : "state-dot"} />{c.migrated ? "GRADUATED" : "SWIMMING"}</span>
            </Link>
          ))}

          {!loading && creatures.length === 0 && (
            <div className="field-empty">
              {filter === "mine" && !publicKey
                ? "connect a wallet to see your creatures."
                : "nothing matches this filter yet."}
            </div>
          )}
        </div>
      </main>
    </Shell>
  );
}
