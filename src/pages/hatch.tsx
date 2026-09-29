import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Shell } from "@/components/Shell";

type PondState = {
  quoteMint: string;
  config: string;
  baseMint: string;
  pool: string;
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

const STORAGE_KEY = "pond.devnet.lab.v1";

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
  const [name, setName] = useState("Pond Frog");
  const [symbol, setSymbol] = useState("FROG");
  const [buyAmount, setBuyAmount] = useState("10");
  const [sellAmount, setSellAmount] = useState("1000");
  const [status, setStatus] = useState<PoolStatus | null>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("waiting by the dock.");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved) as PondState);
    } catch {
      // localStorage is only a convenience for this devnet lab.
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
      await connection.confirmTransaction(signature, "confirmed");
      return signature;
    },
    [connection, publicKey, signTransaction]
  );

  const requestAirdrop = async () => {
    if (!publicKey) return setVisible(true);
    setBusy("airdrop");
    setMessage("asking the faucet for devnet sol...");
    try {
      const signature = await connection.requestAirdrop(
        publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(signature, "confirmed");
      setMessage("2 devnet SOL reached the dock.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "airdrop failed.");
    } finally {
      setBusy("");
    }
  };

  const createTestWater = async () => {
    if (!publicKey || !signTransaction) return setVisible(true);
    setBusy("water");
    setMessage("making a test pond token...");
    try {
      const mint = Keypair.generate();
      const lamports =
        await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
      const ata = getAssociatedTokenAddressSync(
        mint.publicKey,
        publicKey,
        false,
        TOKEN_PROGRAM_ID
      );
      const latest = await connection.getLatestBlockhash("confirmed");

      const tx = new Transaction({
        feePayer: publicKey,
        recentBlockhash: latest.blockhash,
      }).add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mint.publicKey,
          lamports,
          space: MINT_SIZE,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mint.publicKey,
          6,
          publicKey,
          null,
          TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountInstruction(
          publicKey,
          ata,
          publicKey,
          mint.publicKey
        ),
        createMintToInstruction(
          mint.publicKey,
          ata,
          publicKey,
          1_000_000n * 10n ** 6n
        )
      );

      const signature = await sendPartiallySigned(tx, mint);
      setState({
        quoteMint: mint.publicKey.toBase58(),
        config: "",
        baseMint: "",
        pool: "",
      });
      setStatus(null);
      setMessage("test water created · tx " + short(signature));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "could not make test water.");
    } finally {
      setBusy("");
    }
  };

  const registerPond = async () => {
    if (!publicKey || !signTransaction) return setVisible(true);
    if (!state.quoteMint) {
      setMessage("make or paste a quote mint first.");
      return;
    }

    setBusy("config");
    setMessage("measuring the water...");
    try {
      const config = Keypair.generate();
      const response = await fetch("/api/dbc/create-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteMint: state.quoteMint,
          config: config.publicKey.toBase58(),
          payer: publicKey.toBase58(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "config build failed.");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signature = await sendPartiallySigned(tx, config);

      setState((current) => ({
        ...current,
        config: config.publicKey.toBase58(),
        baseMint: "",
        pool: "",
      }));
      setStatus(null);
      setMessage("pond registered · tx " + short(signature));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "pond registration failed.");
    } finally {
      setBusy("");
    }
  };

  const hatchCreature = async () => {
    if (!publicKey || !signTransaction) return setVisible(true);
    if (!state.config) {
      setMessage("register the pond before hatching.");
      return;
    }

    setBusy("hatch");
    setMessage("the egg is moving...");
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
      if (!response.ok) throw new Error(data.error || "launch build failed.");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signature = await sendPartiallySigned(tx, baseMint);

      setState((current) => ({
        ...current,
        baseMint: data.baseMint,
        pool: data.pool,
      }));
      setMessage("something just hatched · tx " + short(signature));
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
      if (!response.ok) throw new Error(data.error || "status read failed.");
      setStatus(data as PoolStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "can't see through the water.");
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
    setMessage(direction === "buy" ? "big splash..." : "swimming back...");
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
      if (!response.ok) throw new Error(data.error || "swap build failed.");

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
          <span>DEVNET HATCHERY · REAL TRANSACTIONS</span>
          <h1>hatch something</h1>
          <p>one test pond, one real DBC creature, then make the water move.</p>
        </div>

        {!canSign && (
          <section className="lab-panel dock-panel">
            <small>YOU'RE STANDING ON THE DOCK</small>
            <h2>connect a devnet wallet</h2>
            <button type="button" onClick={() => setVisible(true)}>Connect</button>
          </section>
        )}

        <div className="lab-grid">
          <section className="lab-panel">
            <small>00 · FUEL</small>
            <h2>devnet sol</h2>
            <p>The launch and test transactions need devnet SOL for rent and fees.</p>
            <button type="button" disabled={Boolean(busy)} onClick={requestAirdrop}>
              {busy === "airdrop" ? "waiting..." : "Airdrop 2 SOL"}
            </button>
          </section>

          <section className="lab-panel">
            <small>01 · CHOOSE THE WATER</small>
            <h2>test pond token</h2>
            <p>Create a standard 6-decimal SPL token and mint 1,000,000 units to your wallet.</p>
            <button type="button" disabled={Boolean(busy)} onClick={createTestWater}>
              {busy === "water" ? "making water..." : "Make test water"}
            </button>
            <label className="lab-input">
              <span>quote mint</span>
              <input
                value={state.quoteMint}
                onChange={(e) =>
                  setState((current) => ({
                    ...current,
                    quoteMint: e.target.value.trim(),
                    config: "",
                    baseMint: "",
                    pool: "",
                  }))
                }
                placeholder="or paste a standard devnet SPL mint"
              />
            </label>
          </section>

          <section className="lab-panel">
            <small>02 · REGISTER THE POND</small>
            <h2>dbc config</h2>
            <p>Builds and signs a real Meteora DBC config using the selected quote mint.</p>
            <button
              type="button"
              disabled={Boolean(busy) || !state.quoteMint}
              onClick={registerPond}
            >
              {busy === "config" ? "measuring..." : "Register pond"}
            </button>
            <div className="address-readout">
              <span>config</span><strong>{short(state.config)}</strong>
            </div>
          </section>

          <section className="lab-panel">
            <small>03 · HATCH</small>
            <h2>new creature</h2>
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
                <div><small>WATER</small><strong>{status?.quoteReserve ?? "checking..."}</strong></div>
                <div><small>GRADUATES AT</small><strong>{status?.migrationQuoteThreshold ?? "checking..."}</strong></div>
                <div><small>PROGRESS</small><strong>{status ? status.progressPercent + "%" : "—"}</strong></div>
              </div>
            </div>

            <div className="swap-grid">
              <div className="swap-box">
                <small>BUY · QUOTE → CREATURE</small>
                <input value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)} />
                <button type="button" disabled={Boolean(busy)} onClick={() => void swap("buy")}>
                  {busy === "buy" ? "splashing..." : "Buy creature"}
                </button>
              </div>
              <div className="swap-box">
                <small>SELL · CREATURE → QUOTE</small>
                <input value={sellAmount} onChange={(e) => setSellAmount(e.target.value)} />
                <button type="button" disabled={Boolean(busy)} onClick={() => void swap("sell")}>
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
            setStatus(null);
            setMessage("lab cleared. on-chain accounts were not deleted.");
          }}
        >
          clear local lab
        </button>
      </main>
    </Shell>
  );
}
