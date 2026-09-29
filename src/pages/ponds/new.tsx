import { useState } from "react";
import { useRouter } from "next/router";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Shell } from "@/components/Shell";
import { mediaUrl, shortAddress } from "@/lib/display";
import { useWorld } from "@/hooks/useWorld";

type Inspection = {
  mint: string;
  name: string | null;
  symbol: string | null;
  imageUri: string | null;
  decimals: number;
  priceUsd: number | null;
  tokenProgram: "spl-token" | "token-2022";
  tokenBadgeExists: boolean;
  launchSupportedNow: boolean;
  origin: "native-sol" | "pump.fun" | "solana";
  isNativeSol: boolean;
  eligibility: {
    eligible: boolean;
    minimumLiquidityUsd: number;
    reasons: string[];
  };
  warnings: string[];
  market: {
    liquidityUsd: number | null;
    marketCap: number | null;
    url: string | null;
  } | null;
};

type Prepared = {
  alreadyRegistered: boolean;
  transaction?: string;
  quoteMint?: string;
  config?: string;
  pond?: { mint: string; symbol: string; name: string; config: string };
  inspection: Inspection;
  economics?: {
    migrationTargetUsd: number | null;
    migrationQuoteThreshold: number;
    tradingFeeBps: number;
    creatorFeeSharePercent: number;
  };
};

function money(value: number | null | undefined) {
  if (!value) return "—";
  return "$" + value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function OpenPondPage() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const { refresh } = useWorld();

  const [input, setInput] = useState("");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(
    "paste an existing Solana token. p0nd will verify it before anything is created."
  );

  const inspect = async (override?: string) => {
    const rawInput = (override ?? input).trim();
    if (!rawInput) return;
    setBusy("inspect");
    setPrepared(null);
    setMessage("checking the token, market and Meteora compatibility...");
    try {
      const response = await fetch(
        "/api/tokens/inspect?mint=" + encodeURIComponent(rawInput),
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not inspect token.");
      setInspection(data as Inspection);
      setInput(data.mint);
      setMessage(
        data.eligibility?.eligible
          ? "token verified · this can become a p0nd habitat."
          : "not eligible yet · " +
            (data.eligibility?.reasons?.join(" · ") ||
              data.warnings?.[0] ||
              "this token cannot be used as a pond right now.")
      );
    } catch (err) {
      setInspection(null);
      setMessage(err instanceof Error ? err.message : "Could not inspect token.");
    } finally {
      setBusy("");
    }
  };

  const openPond = async () => {
    if (!publicKey || !signTransaction) {
      setVisible(true);
      return;
    }
    if (!inspection?.eligibility?.eligible) {
      setMessage(
        inspection?.eligibility?.reasons?.join(" · ") ||
          "inspect an eligible token first."
      );
      return;
    }

    setBusy("open");
    setMessage("building the one-time pond registration...");
    try {
      const response = await fetch("/api/ponds/prepare-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: inspection.mint,
          payer: publicKey.toBase58(),
        }),
      });
      const data = (await response.json()) as Prepared & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not prepare pond.");
      setPrepared(data);

      if (data.alreadyRegistered && data.pond) {
        await refresh();
        setMessage("$" + data.pond.symbol + " is already an open pond.");
        await router.push("/pond/" + data.pond.mint);
        return;
      }

      if (!data.transaction || !data.quoteMint) {
        throw new Error("Registration transaction was not returned.");
      }

      setMessage("confirm the one-time pond transaction in your wallet.");
      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signed = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) {
        throw new Error("Pond transaction failed: " + JSON.stringify(confirmation.value.err));
      }

      setMessage("pond is on-chain · adding it to the p0nd registry...");
      const finalize = await fetch("/api/ponds/finalize-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: data.quoteMint,
          payer: publicKey.toBase58(),
          signature,
        }),
      });
      const finalData = await finalize.json();
      if (!finalize.ok) {
        throw new Error(finalData.error || "Pond opened, but registry sync failed.");
      }

      await refresh();
      setMessage("$" + finalData.pond.symbol + " is now an open pond.");
      await router.push("/pond/" + finalData.pond.mint);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open pond.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Shell>
      <main className="page open-pond-page">
        <div className="page-title manual-title">
          <span>OPEN A POND · ONE-TIME REGISTRATION</span>
          <h1>make a token a habitat</h1>
          <p>
            The pond asset already exists. Paste any compatible Solana token — including
            a Pump.fun token — or use native SOL. p0nd creates the reusable Meteora quote config;
            it does not re-mint or custody the pond asset.
          </p>
        </div>

        <section className="open-pond-flow">
          <div className="open-pond-step">
            <small>01 · EXISTING TOKEN</small>
            <strong>$PAID</strong>
            <span>already live on Solana</span>
          </div>
          <b>→</b>
          <div className="open-pond-step active">
            <small>02 · OPEN ON p0nd</small>
            <strong>PAID POND</strong>
            <span>register once</span>
          </div>
          <b>→</b>
          <div className="open-pond-step">
            <small>03 · MANY CREATURES</small>
            <strong>FISH / PAID</strong>
            <span>FROG / PAID · MOTH / PAID</span>
          </div>
        </section>

        <section className="open-pond-console">
          <label>
            <span>TOKEN CA OR MARKET LINK</span>
            <div className="pond-input-row">
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setInspection(null);
                  setPrepared(null);
                }}
                placeholder="paste CA, Pump.fun, Axiom, DexScreener link — or type SOL"
              />
              <button type="button" disabled={busy === "inspect"} onClick={() => void inspect()}>
                {busy === "inspect" ? "CHECKING..." : "INSPECT TOKEN"}
              </button>
              <button
                type="button"
                disabled={busy === "inspect"}
                onClick={() => {
                  setInput("SOL");
                  setInspection(null);
                  setPrepared(null);
                  void inspect("SOL");
                }}
              >
                USE SOL
              </button>
            </div>
          </label>

          {inspection && (
            <div className="open-pond-inspection">
              <div className="open-pond-token">
                {inspection.imageUri ? <img src={mediaUrl(inspection.imageUri)} alt="" /> : <div>◌</div>}
                <span>
                  <small>VERIFIED MINT</small>
                  <strong>{"$" + (inspection.symbol || "TOKEN")}</strong>
                  <b>{inspection.name || shortAddress(inspection.mint, 7)}</b>
                </span>
              </div>

              <dl>
                <div><dt>mint</dt><dd>{shortAddress(inspection.mint, 8)}</dd></div>
                <div><dt>price</dt><dd>{money(inspection.priceUsd)}</dd></div>
                <div><dt>market liquidity</dt><dd>{money(inspection.market?.liquidityUsd)}</dd></div>
                <div><dt>market cap</dt><dd>{money(inspection.market?.marketCap)}</dd></div>
                <div><dt>decimals</dt><dd>{inspection.decimals}</dd></div>
                <div><dt>source</dt><dd>{inspection.origin === "pump.fun" ? "PUMP.FUN / PUMPSWAP" : inspection.origin === "native-sol" ? "NATIVE SOL" : "SOLANA TOKEN"}</dd></div>
                <div><dt>token program</dt><dd>{inspection.tokenProgram === "token-2022" ? "TOKEN-2022" : "SPL TOKEN"}</dd></div>
                <div><dt>Meteora badge</dt><dd>{inspection.tokenProgram === "token-2022" ? (inspection.tokenBadgeExists ? "FOUND" : "MISSING") : "NOT NEEDED"}</dd></div>
                <div><dt>p0nd</dt><dd>{inspection.eligibility?.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}</dd></div>
              </dl>

              {(inspection.eligibility?.reasons?.length > 0 || inspection.warnings.length > 0) && (
                <ul>
                  {inspection.eligibility?.reasons?.map((reason) => <li key={"eligibility-" + reason}>{reason}</li>)}
                  {inspection.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              )}
            </div>
          )}

          {prepared?.economics && (
            <div className="pond-economics-preview">
              <div><small>GRADUATION TARGET</small><strong>{money(prepared.economics.migrationTargetUsd)}</strong></div>
              <div><small>QUOTE THRESHOLD</small><strong>{prepared.economics.migrationQuoteThreshold.toLocaleString(undefined, { maximumFractionDigits: 4 })} {inspection?.symbol}</strong></div>
              <div><small>TRADING FEE</small><strong>{prepared.economics.tradingFeeBps / 100}%</strong></div>
              <div><small>CREATOR SHARE</small><strong>{prepared.economics.creatorFeeSharePercent}% of trading fees</strong></div>
            </div>
          )}

          <button
            className="open-pond-button"
            type="button"
            disabled={Boolean(busy) || !inspection?.eligibility?.eligible}
            onClick={() => void openPond()}
          >
            {busy === "open"
              ? "OPENING POND..."
              : inspection && !inspection.eligibility?.eligible
              ? "TOKEN NOT ELIGIBLE"
              : publicKey
              ? "OPEN THIS POND"
              : "CONNECT WALLET TO OPEN"}
          </button>

          <p className="open-pond-note">
            Opening a pond does not transfer the pond token to p0nd and does not give
            anyone ownership of that token. It creates the reusable launch configuration
            that future creature markets use as their quote asset.
          </p>
        </section>

        <div className="lab-message">
          <small>p0nd LOG</small>
          <strong>{message}</strong>
        </div>
      </main>
    </Shell>
  );
}
