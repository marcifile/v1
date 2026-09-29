import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import { formatBaseUnits, mediaUrl, shortAddress } from "@/lib/display";

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
  const { world, loading, error, refresh } = useWorld(10000);
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  const [live, setLive] = useState<LiveStatus | null>(null);
  const [liveError, setLiveError] = useState("");
  const [buyAmount, setBuyAmount] = useState("10");
  const [sellAmount, setSellAmount] = useState("1000");
  const [busy, setBusy] = useState("");
  const [tradeLog, setTradeLog] = useState("ready by the water.");

  const creature = useMemo(
    () => world?.creatures.find((c) => c.mint === id) ?? null,
    [world, id]
  );

  const events = useMemo(
    () =>
      (world?.events ?? [])
        .filter((event) => event.creature_mint === id)
        .slice(0, 6),
    [world, id]
  );

  const loadStatus = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(
        "/api/dbc/status?baseMint=" + encodeURIComponent(id),
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "status read failed.");
      setLive(data as LiveStatus);
      setLiveError("");
    } catch (err) {
      setLiveError(
        err instanceof Error ? err.message : "can't see through the water."
      );
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void loadStatus();
    const timer = window.setInterval(() => void loadStatus(), 8000);
    return () => window.clearInterval(timer);
  }, [id, loadStatus]);

  const swap = async (direction: "buy" | "sell") => {
    if (!publicKey || !signTransaction) {
      setVisible(true);
      return;
    }
    if (!creature) return;

    const amount = direction === "buy" ? buyAmount : sellAmount;
    setBusy(direction);
    setTradeLog(direction === "buy" ? "making a splash..." : "swimming back...");

    try {
      const response = await fetch("/api/dbc/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMint: creature.mint,
          owner: publicKey.toBase58(),
          direction,
          amount,
          slippageBps: 300,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "swap build failed.");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signed = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      const confirmation = await connection.confirmTransaction(
        signature,
        "confirmed"
      );
      if (confirmation.value.err) {
        throw new Error("transaction failed: " + JSON.stringify(confirmation.value.err));
      }

      await fetch("/api/creatures/record-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMint: creature.mint,
          type: direction,
          actor: publicKey.toBase58(),
          txSignature: signature,
          amountIn: amount,
          amountOut: data.expectedAmountOut,
        }),
      });

      await Promise.all([loadStatus(), refresh()]);
      setTradeLog(
        (direction === "buy" ? "bought · " : "sold · ") +
          "expected out " +
          data.expectedAmountOut +
          " · " +
          shortAddress(signature, 6)
      );
    } catch (err) {
      setTradeLog(err instanceof Error ? err.message : "trade failed.");
    } finally {
      setBusy("");
    }
  };

  if (loading && !creature) {
    return (
      <Shell>
        <main className="page"><div className="field-empty">checking the water...</div></main>
      </Shell>
    );
  }

  if (!creature) {
    return (
      <Shell>
        <main className="page">
          <div className="page-title manual-title">
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
    formatBaseUnits(creature.quote_reserve_base_units, creature.quote_decimals, 6);
  const threshold =
    live?.migrationQuoteThreshold ??
    formatBaseUnits(
      creature.migration_threshold_base_units,
      creature.quote_decimals,
      6
    );

  return (
    <Shell>
      <main className="page specimen-page">
        <section className="specimen-sheet">
          <div className="specimen-scene">
            <div className="specimen-sky" />
            <div className="specimen-horizon" />
            <div className="specimen-water" />
            <span className="room-label">
              {"POND / $" + (creature.pond_symbol ?? "QUOTE")}
            </span>

            <div className="specimen-art">
              <img src={mediaUrl(creature.image_uri)} alt={creature.name} />
            </div>

            <div className="specimen-name">
              <small>SPECIMEN</small>
              <h1>{"$" + creature.symbol}</h1>
              <p>{"living in $" + (creature.pond_symbol ?? "?")}</p>
              {creature.description && <span>{creature.description}</span>}
            </div>
          </div>

          <div className="specimen-data">
            <header>
              <small>LIVE SPECIMEN CARD</small>
              <span><i /> READ FROM CHAIN</span>
            </header>

            <div className="specimen-stat"><small>WATER / QUOTE RESERVE</small><strong>{water} {creature.pond_symbol}</strong></div>
            <div className="specimen-stat"><small>GRADUATES AT</small><strong>{threshold} {creature.pond_symbol}</strong></div>
            <div className="specimen-stat"><small>GRADUATION</small><strong>{progressPercent}%</strong></div>

            <div className="specimen-meter"><span style={{ width: Math.max(0, Math.min(100, progressPercent)) + "%" }} /></div>

            <div className="specimen-addresses">
              <div><small>POOL</small><strong>{shortAddress(creature.pool, 7)}</strong></div>
              <div><small>CREATOR</small><strong>{shortAddress(creature.creator, 7)}</strong></div>
              <div><small>MINT</small><strong>{shortAddress(creature.mint, 7)}</strong></div>
            </div>

            <p className="read-state">
              {liveError
                ? "live read delayed · " + liveError
                : live?.isMigrated
                ? "graduated into deeper water."
                : "live · water updates automatically"}
            </p>
          </div>
        </section>

        <section className="trade-station">
          <div className="trade-box">
            <small>BUY · {creature.pond_symbol} → {creature.symbol}</small>
            <input value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} />
            <button type="button" disabled={Boolean(busy)} onClick={() => void swap("buy")}>
              {busy === "buy" ? "SPLASHING..." : publicKey ? "BUY CREATURE" : "CONNECT TO BUY"}
            </button>
          </div>
          <div className="trade-box">
            <small>SELL · {creature.symbol} → {creature.pond_symbol}</small>
            <input value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} />
            <button type="button" disabled={Boolean(busy)} onClick={() => void swap("sell")}>
              {busy === "sell" ? "SWIMMING..." : publicKey ? "SELL CREATURE" : "CONNECT TO SELL"}
            </button>
          </div>
          <div className="trade-log"><small>TRADE LOG</small><strong>{tradeLog}</strong></div>
        </section>

        <section className="activity-panel">
          <header><small>RECENT RIPPLES</small><strong>ACTIVITY</strong></header>
          {events.map((event) => (
            <div className="activity-row" key={event.id}>
              <time>{new Date(event.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              <strong>{event.type.toUpperCase()}</strong>
              <span>{event.amount_in ? event.amount_in + " in" : "indexed"}</span>
              <span>{event.tx_signature ? shortAddress(event.tx_signature, 6) : "chain"}</span>
            </div>
          ))}
          {events.length === 0 && <div className="field-empty">no ripples yet.</div>}
        </section>
      </main>
    </Shell>
  );
}
