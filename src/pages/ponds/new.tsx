import { useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { usePondWalletConnect } from "@/hooks/usePondWalletConnect";
import { Shell } from "@/components/Shell";
import { mediaUrl, shortAddress } from "@/lib/display";
import { useWorld } from "@/hooks/useWorld";
import { extractSolanaAddress } from "@/lib/addressInput";
import { inspectToken } from "@/lib/tokenInspection";

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
  meteoraSupported: boolean;
  raydiumSupported: boolean;
  launchEngine: "meteora-dbc" | "raydium-cpmm" | null;
  tokenExtensions: string[];
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
  registeredNow?: boolean;
  launchEngine?: "meteora-dbc" | "raydium-cpmm";
  transaction?: string;
  quoteMint?: string;
  config?: string;
  pond?: { mint: string; symbol: string; name: string; config: string; launch_engine?: "meteora-dbc" | "raydium-cpmm" };
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

type PageProps = {
  initialInput: string;
  initialInspection: Inspection | null;
  initialMessage: string | null;
};

export const getServerSideProps: GetServerSideProps<PageProps> = async (context) => {
  const raw = typeof context.query.mint === "string" ? context.query.mint.trim() : "";
  if (!raw) {
    return {
      props: {
        initialInput: "",
        initialInspection: null,
        initialMessage: null,
      },
    };
  }

  try {
    const mint = extractSolanaAddress(raw, "Contract address");
    const inspected = await inspectToken(mint, "mainnet");
    const reasons: string[] = [];
    if (!inspected.launchSupportedNow) {
      reasons.push(
        inspected.tokenProgram === "token-2022"
          ? "This Token-2022 mint uses extensions that are not supported by the available permissionless pool routes."
          : "This token program cannot be used as a pond quote asset."
      );
    }

    const initialInspection = {
      ...inspected,
      eligibility: {
        eligible: reasons.length === 0,
        minimumLiquidityUsd: 0,
        reasons,
      },
    } as Inspection;

    return {
      props: {
        initialInput: initialInspection.mint,
        initialInspection,
        initialMessage:
          reasons.length === 0
            ? "token found · ready to open as a pond."
            : "not compatible · " + reasons.join(" · "),
      },
    };
  } catch (error) {
    return {
      props: {
        initialInput: raw,
        initialInspection: null,
        initialMessage:
          error instanceof Error ? error.message : "Could not fetch token.",
      },
    };
  }
};

export default function OpenPondPage({
  initialInput,
  initialInspection,
  initialMessage,
}: PageProps) {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { connectWallet, walletConnecting } = usePondWalletConnect();
  const { refresh } = useWorld();

  const [input, setInput] = useState(initialInput);
  const [inspection, setInspection] = useState<Inspection | null>(initialInspection);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(
    initialMessage ||
      "paste a CA. p0nd will fetch the token and show you exactly what will become the pond."
  );

  const inspect = async (override?: string) => {
    const rawInput = (override ?? input).trim();
    if (!rawInput) return;
    setBusy("inspect");
    setPrepared(null);
    setMessage("fetching token...");
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
          ? "token found · ready to open as a pond."
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
    if (!inspection?.eligibility?.eligible) {
      setMessage(
        inspection?.eligibility?.reasons?.join(" · ") ||
          "inspect an eligible token first."
      );
      return;
    }

    if (inspection.launchEngine !== "raydium-cpmm" && (!publicKey || !signTransaction)) {
      connectWallet();
      return;
    }

    setBusy("open");
    setMessage(
      inspection.launchEngine === "raydium-cpmm"
        ? "opening pond..."
        : "building the one-time pond registration..."
    );
    try {
      const response = await fetch("/api/ponds/prepare-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: inspection.mint,
          payer: publicKey?.toBase58() || null,
        }),
      });
      const data = (await response.json()) as Prepared & { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not prepare pond.");
      setPrepared(data);

      if (data.alreadyRegistered && data.pond) {
        await refresh();
        setMessage(
          data.registeredNow
            ? "$" + data.pond.symbol + " pond opened."
            : "$" + data.pond.symbol + " is already an open pond."
        );
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
          <span>OPEN A POND</span>
          <h1>paste a CA. open a pond.</h1>
          <p>
            the token already exists. paste its CA, p0nd fetches it, and that token becomes the currency for every creature launched inside its pond.
          </p>
        </div>

        <section className="open-pond-flow">
          <div className="open-pond-step">
            <small>01 · PASTE CA</small>
            <strong>{inspection?.symbol ? "$" + inspection.symbol : "ANY CA"}</strong>
            <span>existing coin</span>
          </div>
          <b>→</b>
          <div className="open-pond-step active">
            <small>02 · OPEN POND</small>
            <strong>{inspection?.symbol ? inspection.symbol + " POND" : "NEW POND"}</strong>
            <span>one habitat</span>
          </div>
          <b>→</b>
          <div className="open-pond-step">
            <small>03 · MANY CREATURES</small>
            <strong>{"FISH / " + (inspection?.symbol || "POND")}</strong>
            <span>{"FROG / " + (inspection?.symbol || "POND") + " · MOTH / " + (inspection?.symbol || "POND")}</span>
          </div>
        </section>

        <section className="open-pond-console">
          <form id="pond-fetch-form" method="get" action="/ponds/new">
            <label>
              <span>CONTRACT ADDRESS</span>
              <div className="pond-input-row">
                <input
                  name="mint"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setInspection(null);
                    setPrepared(null);
                  }}
                  placeholder="paste CA"
                  autoComplete="off"
                />
                <button type="submit" disabled={busy === "inspect"}>
                  {busy === "inspect" ? "FETCHING..." : "FETCH TOKEN"}
                </button>
              </div>
            </label>
          </form>

          {inspection && (
            <div className="open-pond-inspection">
              <div className="open-pond-token">
                {inspection.imageUri ? <img src={mediaUrl(inspection.imageUri)} alt="" /> : <div>◌</div>}
                <span>
                  <small>FOUND</small>
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
                <div><dt>origin</dt><dd>{inspection.origin === "pump.fun" ? "PUMP.FUN / PUMPSWAP" : inspection.origin === "native-sol" ? "SOL" : "ON-CHAIN"}</dd></div>
                <div><dt>token program</dt><dd>{inspection.tokenProgram === "token-2022" ? "TOKEN-2022" : "SPL TOKEN"}</dd></div>
                <div><dt>launch route</dt><dd>{inspection.launchEngine === "meteora-dbc" ? "METEORA DBC" : inspection.launchEngine === "raydium-cpmm" ? "RAYDIUM CPMM" : "NONE"}</dd></div>
                <div><dt>pond</dt><dd>{inspection.eligibility?.eligible ? "READY" : "NOT COMPATIBLE"}</dd></div>
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
            type={inspection ? "button" : "submit"}
            form={inspection ? undefined : "pond-fetch-form"}
            disabled={Boolean(busy)}
            onClick={inspection ? () => void openPond() : undefined}
          >
            {busy === "inspect"
              ? "FETCHING TOKEN..."
              : busy === "open"
              ? "OPENING POND..."
              : !inspection
              ? "FETCH TOKEN"
              : inspection && !inspection.eligibility?.eligible
              ? "NOT COMPATIBLE"
              : inspection?.launchEngine === "raydium-cpmm"
              ? "OPEN POND"
              : publicKey
              ? "OPEN POND"
              : walletConnecting
              ? "CONNECTING..."
              : "CONNECT WALLET & OPEN"}
          </button>

          <p className="open-pond-note">
            p0nd does not take ownership of the existing coin. opening a pond simply makes that coin the quote currency for creatures launched inside it.
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
