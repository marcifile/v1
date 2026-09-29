import { useCallback, useEffect, useMemo, useState } from "react";
import { Keypair, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Shell } from "@/components/Shell";

type PondState = {
  quoteMint: string;
  config: string;
  baseMint: string;
  pool: string;
};

type SetupInfo = {
  waterBalance: string;
  feesSponsored: boolean;
};

type PoolStatus = {
  pool: string;
  baseMint: string;
  quoteMint: string;
  config: string;
  quoteReserve: string;
  migrationQuoteThreshold: string;
  progressPercent: number;
  isMigrated: boolean;
  updatedAt: string;
};

const STORAGE_KEY = "pond.devnet.lab.v2";

function short(value: string) {
  if (!value) return "—";
  return value.slice(0, 6) + "…" + value.slice(-6);
}

export default function HatchPage() {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { setVisible } = useWalletModal();

  const [state, setState] = useState<PondState>({
    quoteMint: "",
    config: "",
    baseMint: "",
    pool: "",
  });
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [name, setName] = useState("Pond Frog");
  const [symbol, setSymbol] = useState("FROG");
  const [buyAmount, setBuyAmount] = useState("10");
  const [sellAmount, setSellAmount] = useState("1000");
  const [status, setStatus] = useState<PoolStatus | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(
    "connect a wallet, then prepare the test pond."
  );

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved) as PondState);
    } catch {
      // local-only devnet convenience
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const canSign = Boolean(publicKey && signTransaction);

  const sendPartiallySigned = useCallback(
    async (transaction: Transaction, signer?: Keypair) => {
      if (!publicKey || !signTransaction) {
        throw new Error("Connect a wallet first.");
      }

      if (signer) transaction.partialSign(signer);
      const signed = await signTransaction(transaction);
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
          "Transaction failed: " + JSON.stringify(confirmation.value.err)
        );
      }
      return signature;
    },
    [connection, publicKey, signTransaction]
  );

  const preparePond = async () => {
    if (!publicKey) return setVisible(true);

    setBusy("prepare");
    setMessage("getting the test pond ready...");
    try {
      const response = await fetch("/api/devnet/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: publicKey.toBase58() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "could not prepare the test pond.");
      }

      setState({
        quoteMint: data.quoteMint,
        config: data.config,
        baseMint: "",
        pool: "",
      });
      setSetup({
        waterBalance: data.waterBalance,
        feesSponsored: Boolean(data.feesSponsored),
      });
      setStatus(null);
      setMessage(
        "test pond ready · 1,000,000 WATER is in your wallet · devnet fees are sponsored."
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "test pond setup failed."
      );
    } finally {
      setBusy("");
    }
  };

  const hatchCreature = async () => {
    if (!publicKey || !signTransaction) return setVisible(true);
    if (!state.config) {
      setMessage("prepare the test pond first.");
      return;
    }

    setBusy("hatch");
    setMessage("building the creature launch...");
    try {
      const baseMint = Keypair.generate();
      const metadataUri =
        window.location.origin +
        "/api/metadata/" +
        baseMint.publicKey.toBase58() +
        "?name=" +
        encodeURIComponent(name.trim()) +
        "&symbol=" +
        encodeURIComponent(symbol.trim().toUpperCase());

      const response = await fetch("/api/dbc/create-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: state.config,
          baseMint: baseMint.publicKey.toBase58(),
          payer: publicKey.toBase58(),
          name,
          symbol,
          uri: metadataUri,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "launch build failed.");
      }

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signature = await sendPartiallySigned(tx, baseMint);

      setState((current) => ({
        ...current,
        baseMint: data.baseMint,
        pool: data.pool,
      }));
      setMessage(
        "something just hatched · " +
          short(data.baseMint) +
          " · tx " +
          short(signature)
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "hatch failed.");
    } finally {
      setBusy("");
    }
  };

  const refreshStatus = useCallback(async () => {
    if (!state.baseMint) return;
    try {
      const response = await fetch(
        "/api/dbc/status?baseMint=" + encodeURIComponent(state.baseMint)
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "status read failed.");
      }
      setStatus(data as PoolStatus);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "can't see through the water."
      );
    }
  }, [state.baseMint]);

  useEffect(() => {
    if (!state.baseMint) return;
    void refreshStatus();
    const timer = window.setInterval(() => void refreshStatus(), 8000);
    return () => window.clearInterval(timer);
  }, [refreshStatus, state.baseMint]);

  const swap = async (direction: "buy" | "sell") => {
    if (!publicKey || !signTransaction) return setVisible(true);
    if (!state.baseMint) {
      setMessage("hatch a creature first.");
      return;
    }

    const amount = direction === "buy" ? buyAmount : sellAmount;
    setBusy(direction);
    setMessage(direction === "buy" ? "making a splash..." : "swimming back...");
    try {
      const response = await fetch("/api/dbc/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMint: state.baseMint,
          owner: publicKey.toBase58(),
          direction,
          amount,
          slippageBps: 300,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "swap build failed.");
      }

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signature = await sendPartiallySigned(tx);
      setMessage(
        (direction === "buy" ? "bought · " : "sold · ") +
          "expected out " +
          data.expectedAmountOut +
          " · tx " +
          short(signature)
      );
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "swap failed.");
    } finally {
      setBusy("");
    }
  };

  const progress = useMemo(
    () => Math.max(0, Math.min(100, status?.progressPercent ?? 0)),
    [status]
  );

  return (
    <Shell>
      <main className="page hatch-page">
        <div className="page-title">
          <span>DEVNET HATCHERY · TEST ASSETS HAVE NO VALUE</span>
          <h1>hatch something</h1>
          <p>
            prove one real creature can live in another token before we polish
            the public flow.
          </p>
        </div>

        {!canSign && (
          <section className="lab-panel dock-panel">
            <small>YOU'RE STANDING ON THE DOCK</small>
            <h2>connect a wallet</h2>
            <p>This lab only touches Solana devnet.</p>
            <button type="button" onClick={() => setVisible(true)}>
              Connect
            </button>
          </section>
        )}

        <div className="lab-grid">
          <section className="lab-panel">
            <small>01 · TEST SETUP</small>
            <h2>prepare the pond</h2>
            <p>
              Railway supplies fake devnet gas, test WATER, and the reusable
              Meteora pond config. This step does not ask Phantom to sign.
            </p>
            <button
              type="button"
              disabled={Boolean(busy) || !publicKey}
              onClick={preparePond}
            >
              {busy === "prepare" ? "preparing..." : "Prepare test pond"}
            </button>
            <div className="address-readout">
              <span>water mint</span><strong>{short(state.quoteMint)}</strong>
              <span>dbc config</span><strong>{short(state.config)}</strong>
              <span>your WATER</span><strong>{setup?.waterBalance ?? "—"}</strong>
              <span>devnet fees</span><strong>{setup?.feesSponsored ? "sponsored" : "—"}</strong>
            </div>
          </section>

          <section className="lab-panel">
            <small>02 · HATCH</small>
            <h2>new creature</h2>
            <p>
              This opens Phantom because you own/sign the creature launch.
              Railway pays the devnet fee and account rent for this test.
            </p>
            <label className="lab-input">
              <span>name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="lab-input">
              <span>ticker</span>
              <input
                value={symbol}
                maxLength={10}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              />
            </label>
            <button
              type="button"
              disabled={Boolean(busy) || !state.config}
              onClick={hatchCreature}
            >
              {busy === "hatch" ? "hatching..." : "Hatch creature"}
            </button>
            <div className="address-readout">
              <span>base mint</span><strong>{short(state.baseMint)}</strong>
              <span>pool</span><strong>{short(state.pool)}</strong>
            </div>
          </section>
        </div>

        {state.baseMint && (
          <section className="water-lab">
            <div className="water-readout">
              <small>LIVE · READ FROM CHAIN</small>
              <h2>{status?.isMigrated ? "deeper water" : "pond depth"}</h2>
              <div className="water-meter">
                <span style={{ width: progress + "%" }} />
              </div>
              <div className="water-numbers">
                <div>
                  <small>WATER IN CURVE</small>
                  <strong>{status?.quoteReserve ?? "checking..."}</strong>
                </div>
                <div>
                  <small>GRADUATES AT</small>
                  <strong>{status?.migrationQuoteThreshold ?? "checking..."}</strong>
                </div>
                <div>
                  <small>PROGRESS</small>
                  <strong>{status ? status.progressPercent + "%" : "—"}</strong>
                </div>
              </div>
            </div>

            <div className="swap-grid">
              <div className="swap-box">
                <small>BUY · WATER → CREATURE</small>
                <input
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                />
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void swap("buy")}
                >
                  {busy === "buy" ? "splashing..." : "Buy creature"}
                </button>
              </div>
              <div className="swap-box">
                <small>SELL · CREATURE → WATER</small>
                <input
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                />
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void swap("sell")}
                >
                  {busy === "sell" ? "swimming..." : "Sell creature"}
                </button>
              </div>
            </div>
          </section>
        )}

        <div className="lab-message">
          <small>POND LOG</small>
          <strong>{message}</strong>
        </div>

        <button
          type="button"
          className="reset-lab"
          onClick={() => {
            setState({ quoteMint: "", config: "", baseMint: "", pool: "" });
            setSetup(null);
            setStatus(null);
            setMessage("local lab cleared. devnet accounts still exist.");
          }}
        >
          clear local lab
        </button>
      </main>
    </Shell>
  );
}
