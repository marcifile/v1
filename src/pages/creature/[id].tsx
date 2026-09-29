import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { PublicKey, Transaction } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import {
  formatBaseUnits,
  mediaUrl,
  shortAddress,
  solanaExplorerUrl,
} from "@/lib/display";

type LiveStatus = {
  quoteReserve: string;
  migrationQuoteThreshold: string;
  progressPercent: number;
  isMigrated: boolean;
  creatorQuoteFee: string;
  totalTradingQuoteFee: string;
  creatorTradingFeePercentage: number;
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
  const [walletBalances, setWalletBalances] = useState({
    pond: "0",
    creature: "0",
  });

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

  const loadBalances = useCallback(async () => {
    if (!publicKey || !creature) {
      setWalletBalances({ pond: "0", creature: "0" });
      return;
    }

    try {
      const [pondAta, creatureAta] = await Promise.all([
        getAssociatedTokenAddress(
          new PublicKey(creature.pond_mint),
          publicKey
        ),
        getAssociatedTokenAddress(
          new PublicKey(creature.mint),
          publicKey
        ),
      ]);

      const [pondBalance, creatureBalance] = await Promise.all([
        connection
          .getTokenAccountBalance(pondAta, "confirmed")
          .then((result) => result.value.uiAmountString || "0")
          .catch(() => "0"),
        connection
          .getTokenAccountBalance(creatureAta, "confirmed")
          .then((result) => result.value.uiAmountString || "0")
          .catch(() => "0"),
      ]);

      setWalletBalances({
        pond: pondBalance,
        creature: creatureBalance,
      });
    } catch {
      setWalletBalances({ pond: "0", creature: "0" });
    }
  }, [connection, creature, publicKey]);

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
    void loadBalances();
    const timer = window.setInterval(() => {
      void loadStatus();
      void loadBalances();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [id, loadStatus, loadBalances]);

  const claimCreatorFees = async () => {
    if (!publicKey || !signTransaction) {
      setVisible(true);
      return;
    }
    if (!creature) return;

    if (publicKey.toBase58() !== creature.creator) {
      setTradeLog("only this creature's creator can claim its creator fees.");
      return;
    }

    setBusy("claim");
    setTradeLog("opening the creator fee jar...");

    try {
      const response = await fetch("/api/dbc/claim-creator-fee", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMint: creature.mint,
          creator: publicKey.toBase58(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "could not build creator fee claim.");
      }

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
        throw new Error(
          "transaction failed: " + JSON.stringify(confirmation.value.err)
        );
      }

      await fetch("/api/creatures/record-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMint: creature.mint,
          type: "claim_creator_fee",
          actor: publicKey.toBase58(),
          txSignature: signature,
          amountOut: data.claimQuote,
        }),
      });

      await Promise.all([loadStatus(), loadBalances(), refresh()]);
      setTradeLog(
        "creator fees claimed · " +
          data.claimQuote +
          " " +
          (creature.pond_symbol || "QUOTE") +
          " · " +
          shortAddress(signature, 6)
      );
    } catch (err) {
      setTradeLog(
        err instanceof Error ? err.message : "creator fee claim failed."
      );
    } finally {
      setBusy("");
    }
  };

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

      await Promise.all([loadStatus(), loadBalances(), refresh()]);
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

  const setPercentAmount = (
    side: "buy" | "sell",
    fraction: number
  ) => {
    const raw =
      side === "buy" ? walletBalances.pond : walletBalances.creature;
    const value = Number(raw || "0") * fraction;
    const formatted = value
      .toFixed(6)
      .replace(/0+$/, "")
      .replace(/\.$/, "");
    if (side === "buy") setBuyAmount(formatted || "0");
    else setSellAmount(formatted || "0");
  };

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
  const creatorFee =
    live?.creatorQuoteFee ??
    formatBaseUnits(
      creature.creator_quote_fee_base_units,
      creature.quote_decimals,
      6
    );
  const totalTradingFee =
    live?.totalTradingQuoteFee ??
    formatBaseUnits(
      creature.total_trading_quote_fee_base_units,
      creature.quote_decimals,
      6
    );
  const creatorFeeShare = live?.creatorTradingFeePercentage ?? 50;
  const isCreator =
    Boolean(publicKey) && publicKey?.toBase58() === creature.creator;

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
              {(creature.website_url || creature.x_url || creature.telegram_url) && (
                <div className="specimen-links">
                  {creature.website_url && <a href={creature.website_url} target="_blank" rel="noreferrer">WEB ↗</a>}
                  {creature.x_url && <a href={creature.x_url} target="_blank" rel="noreferrer">X ↗</a>}
                  {creature.telegram_url && <a href={creature.telegram_url} target="_blank" rel="noreferrer">TG ↗</a>}
                </div>
              )}
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
            <div className="specimen-stat fee-stat"><small>TOTAL TRADING FEES</small><strong>{totalTradingFee} {creature.pond_symbol}</strong></div>
            <div className="specimen-stat fee-stat"><small>CREATOR FEES CLAIMABLE</small><strong>{creatorFee} {creature.pond_symbol}</strong><span>{creatorFeeShare}% creator share configured on the DBC</span></div>

            <div className="specimen-meter"><span style={{ width: Math.max(0, Math.min(100, progressPercent)) + "%" }} /></div>

            <div className="specimen-addresses">
              <div><small>POOL</small><strong><a href={solanaExplorerUrl("address", creature.pool)} target="_blank" rel="noreferrer">{shortAddress(creature.pool, 7)} ↗</a></strong></div>
              <div><small>CREATOR</small><strong><a href={solanaExplorerUrl("address", creature.creator)} target="_blank" rel="noreferrer">{shortAddress(creature.creator, 7)} ↗</a></strong></div>
              <div><small>MINT</small><strong><a href={solanaExplorerUrl("address", creature.mint)} target="_blank" rel="noreferrer">{shortAddress(creature.mint, 7)} ↗</a></strong></div>
              {creature.launch_tx && <div><small>LAUNCH TX</small><strong><a href={solanaExplorerUrl("tx", creature.launch_tx)} target="_blank" rel="noreferrer">{shortAddress(creature.launch_tx, 7)} ↗</a></strong></div>}
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

        <section className="creator-vault">
          <div>
            <small>CREATOR ECONOMICS</small>
            <h2>the dev earns in the pond token.</h2>
            <p>
              This creature's DBC is configured so the creator receives {creatorFeeShare}% of
              the creator/partner trading-fee share. Because fees are collected in the quote
              token, the creator earns {creature.pond_symbol}, not {creature.symbol}.
            </p>
          </div>
          <div className="creator-vault-readout">
            <small>CLAIMABLE NOW</small>
            <strong>{creatorFee} {creature.pond_symbol}</strong>
            {isCreator ? (
              <button
                type="button"
                disabled={Boolean(busy) || Number(creatorFee) <= 0}
                onClick={() => void claimCreatorFees()}
              >
                {busy === "claim" ? "CLAIMING..." : "CLAIM CREATOR FEES"}
              </button>
            ) : (
              <span>only the on-chain creator can claim</span>
            )}
          </div>
        </section>

        <section className="trade-station">
          <div className="trade-box">
            <small>BUY · {creature.pond_symbol} → {creature.symbol}</small>
            <div className="wallet-line"><span>wallet</span><strong>{walletBalances.pond} {creature.pond_symbol}</strong></div>
            <input value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} />
            <div className="amount-presets">
              <button type="button" onClick={() => setPercentAmount("buy", .25)}>25%</button>
              <button type="button" onClick={() => setPercentAmount("buy", .5)}>50%</button>
              <button type="button" onClick={() => setPercentAmount("buy", 1)}>MAX</button>
            </div>
            <button type="button" disabled={Boolean(busy)} onClick={() => void swap("buy")}>
              {busy === "buy" ? "SPLASHING..." : publicKey ? "BUY CREATURE" : "CONNECT TO BUY"}
            </button>
          </div>
          <div className="trade-box">
            <small>SELL · {creature.symbol} → {creature.pond_symbol}</small>
            <div className="wallet-line"><span>wallet</span><strong>{walletBalances.creature} {creature.symbol}</strong></div>
            <input value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} />
            <div className="amount-presets">
              <button type="button" onClick={() => setPercentAmount("sell", .25)}>25%</button>
              <button type="button" onClick={() => setPercentAmount("sell", .5)}>50%</button>
              <button type="button" onClick={() => setPercentAmount("sell", 1)}>MAX</button>
            </div>
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
              <span>{event.tx_signature ? <a href={solanaExplorerUrl("tx", event.tx_signature)} target="_blank" rel="noreferrer">{shortAddress(event.tx_signature, 6)} ↗</a> : "chain"}</span>
            </div>
          ))}
          {events.length === 0 && <div className="field-empty">no ripples yet.</div>}
        </section>
      </main>
    </Shell>
  );
}
