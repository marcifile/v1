import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Keypair, Transaction } from "@solana/web3.js";
import { useRouter } from "next/router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { usePondWalletConnect } from "@/hooks/usePondWalletConnect";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import type { WorldPond } from "@/types/world";
import { shortAddress } from "@/lib/display";

type Launched = {
  baseMint: string;
  pool: string;
  metadataUri: string;
};

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

export default function HatchPage() {
  const router = useRouter();
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const { connectWallet, walletConnecting } = usePondWalletConnect();
  const { world, loading, error, refresh } = useWorld(10000);

  const [selectedMint, setSelectedMint] = useState("");
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [telegram, setTelegram] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [firstBuy, setFirstBuy] = useState("");
  const [seedQuote, setSeedQuote] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("choose a pond.");
  const [launched, setLaunched] = useState<Launched | null>(null);

  const ponds = world?.ponds ?? [];
  const selected = useMemo(
    () => ponds.find((pond) => pond.mint === selectedMint) ?? null,
    [ponds, selectedMint]
  );

  useEffect(() => {
    const requested = String(router.query.pond || "");
    if (requested && ponds.some((pond) => pond.mint === requested)) {
      setSelectedMint(requested);
    } else if (!selectedMint && ponds.length === 1) {
      setSelectedMint(ponds[0].mint);
    }
  }, [router.query.pond, ponds, selectedMint]);

  const sendTransaction = useCallback(
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
      const confirmation = await connection.confirmTransaction(signature, "confirmed");
      if (confirmation.value.err) {
        throw new Error("Transaction failed: " + JSON.stringify(confirmation.value.err));
      }
      return signature;
    },
    [connection, publicKey, signTransaction]
  );

  const onImage = async (file?: File) => {
    if (!file) {
      setImageDataUrl("");
      return;
    }
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image must be 5MB or smaller.");
      }
      setImageDataUrl(await readImage(file));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not read image.");
    }
  };

  const hatch = async () => {
    if (!publicKey || !signTransaction) {
      connectWallet();
      return;
    }
    if (!selected) {
      setMessage("choose a pond first.");
      return;
    }
    if (!name.trim() || !symbol.trim()) {
      setMessage("your creature needs a name and ticker.");
      return;
    }
    if (selected.launch_engine === "raydium-cpmm" && !seedQuote.trim()) {
      setMessage("enter how much " + (selected.symbol || "pond token") + " to seed as initial liquidity.");
      return;
    }

    setBusy("hatch");
    setMessage("publishing metadata and building the launch...");
    try {
      const baseMint = Keypair.generate();

      const metaResponse = await fetch("/api/metadata/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMint: baseMint.publicKey.toBase58(),
          name,
          symbol,
          description,
          website,
          x: xUrl,
          telegram,
          imageDataUrl: imageDataUrl || undefined,
        }),
      });
      const metadata = await metaResponse.json();
      if (!metaResponse.ok) throw new Error(metadata.error || "Could not publish metadata.");

      if (selected.launch_engine === "raydium-cpmm") {
        setMessage("creating the creature mint...");

        const mintResponse = await fetch("/api/raydium/create-mint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseMint: baseMint.publicKey.toBase58(),
            payer: publicKey.toBase58(),
          }),
        });
        const mintBuilt = await mintResponse.json();
        if (!mintResponse.ok) {
          throw new Error(mintBuilt.error || "Could not build creature mint.");
        }

        const mintTx = Transaction.from(Buffer.from(mintBuilt.transaction, "base64"));
        await sendTransaction(mintTx, baseMint);

        setMessage(
          "mint created · building " +
            (symbol.trim().toUpperCase() || "CREATURE") +
            " / " +
            (selected.symbol || "POND") +
            " liquidity pool..."
        );

        const poolResponse = await fetch("/api/raydium/create-pool", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseMint: baseMint.publicKey.toBase58(),
            pondMint: selected.mint,
            payer: publicKey.toBase58(),
            creatureLiquidity: "1000000000",
            quoteLiquidity: seedQuote,
          }),
        });
        const poolBuilt = await poolResponse.json();
        if (!poolResponse.ok) {
          throw new Error(poolBuilt.error || "Could not build Raydium pool.");
        }

        const poolTx = Transaction.from(Buffer.from(poolBuilt.transaction, "base64"));
        const launchSignature = await sendTransaction(poolTx);

        setMessage("pool confirmed · adding the creature to p0nd...");

        const registerResponse = await fetch("/api/creatures/register-raydium", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseMint: baseMint.publicKey.toBase58(),
            pondMint: selected.mint,
            pool: poolBuilt.pool,
            creator: publicKey.toBase58(),
            name,
            symbol,
            description,
            website,
            x: xUrl,
            telegram,
            metadataUri: metadata.metadataUri,
            imageUri: metadata.imageUri,
            launchTx: launchSignature,
            quoteLiquidity: seedQuote,
          }),
        });
        const registered = await registerResponse.json();
        if (!registerResponse.ok) {
          throw new Error(
            registered.error ||
              "Pool launched, but p0nd could not register the creature."
          );
        }

        setLaunched({
          baseMint: baseMint.publicKey.toBase58(),
          pool: poolBuilt.pool,
          metadataUri: metadata.metadataUri,
        });
        await refresh();
        setMessage(
          "$" +
            symbol.trim().toUpperCase() +
            " is live in the $" +
            (selected.symbol || "QUOTE") +
            " pond through Raydium."
        );
        return;
      }

      const createResponse = await fetch("/api/dbc/create-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: selected.config,
          baseMint: baseMint.publicKey.toBase58(),
          payer: publicKey.toBase58(),
          name,
          symbol,
          uri: metadata.metadataUri,
        }),
      });
      const built = await createResponse.json();
      if (!createResponse.ok) throw new Error(built.error || "Could not build launch.");

      const tx = Transaction.from(Buffer.from(built.transaction, "base64"));
      const launchSignature = await sendTransaction(tx, baseMint);

      let registerResponse: Response | null = null;
      let registered: any = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        registerResponse = await fetch("/api/creatures/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            baseMint: built.baseMint,
            creator: publicKey.toBase58(),
            name,
            symbol,
            description,
            website,
            x: xUrl,
            telegram,
            metadataUri: metadata.metadataUri,
            imageUri: metadata.imageUri,
            launchTx: launchSignature,
            pondName: selected.name,
            pondSymbol: selected.symbol,
          }),
        });
        registered = await registerResponse.json();
        if (registerResponse.ok) break;
        if (attempt < 2) {
          await new Promise((resolve) => window.setTimeout(resolve, 900 * (attempt + 1)));
        }
      }

      setLaunched({
        baseMint: built.baseMint,
        pool: built.pool,
        metadataUri: metadata.metadataUri,
      });

      if (!registerResponse?.ok) {
        throw new Error(
          "Token launched on-chain, but indexing is still catching up: " +
            (registered?.error || "unknown error") +
            ". Mint: " +
            built.baseMint
        );
      }

      await refresh();
      setMessage(
        "$" +
          symbol.trim().toUpperCase() +
          " is live in the $" +
          (selected.symbol || "QUOTE") +
          " pond."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Hatch failed.");
    } finally {
      setBusy("");
    }
  };

  const firstSwim = async () => {
    if (!publicKey || !signTransaction || !launched || !firstBuy.trim()) return;
    setBusy("buy");
    setMessage("building the first buy...");
    try {
      const response = await fetch(
        selected?.launch_engine === "raydium-cpmm"
          ? "/api/raydium/swap"
          : "/api/dbc/swap",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMint: launched.baseMint,
          owner: publicKey.toBase58(),
          direction: "buy",
          amount: firstBuy,
          slippageBps: 300,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not build buy.");

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const signature = await sendTransaction(tx);

      await fetch("/api/creatures/record-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMint: launched.baseMint,
          type: "buy",
          actor: publicKey.toBase58(),
          txSignature: signature,
          amountIn: firstBuy,
          amountOut: data.expectedAmountOut,
        }),
      });

      await refresh();
      setMessage(
        "first buy confirmed · " +
          firstBuy +
          " " +
          (selected?.symbol || "QUOTE") +
          " entered the curve."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "First buy failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Shell>
      <main className="page hatch-public">
        <div className="page-title manual-title">
          <span>HATCHERY · LIVE SOLANA LAUNCH</span>
          <h1>hatch a creature</h1>
          <p>
            pick the existing token economy it lives in, then launch a real SPL token against it.
          </p>
        </div>

        <div className="hatch-concept-strip">
          <div><small>POND TOKEN</small><strong>{selected ? "$" + selected.symbol : "$PAID"}</strong></div>
          <b>becomes the quote asset →</b>
          <div><small>NEW CREATURE</small><strong>{symbol ? "$" + symbol : "$FISH"}</strong></div>
          <b>trades as →</b>
          <div><small>REAL MARKET</small><strong>{symbol || "FISH"} / {selected?.symbol || "PAID"}</strong></div>
        </div>

        {!publicKey && (
          <section className="hatch-step hatch-connect">
            <small>WALLET</small>
            <h2>connect to launch</h2>
            <button type="button" disabled={walletConnecting} onClick={connectWallet}>
              {walletConnecting ? "Connecting..." : "Connect wallet"}
            </button>
          </section>
        )}

        <section className="hatch-step">
          <div className="step-number">01</div>
          <div className="step-body">
            <small>CHOOSE A POND</small>
            <h2>what token should people use to trade it?</h2>
            <p className="muted">
              {loading
                ? "loading open ponds..."
                : error ||
                  "each pond is an existing Solana token with one reusable Meteora launch config."}
            </p>

            <div className="pond-picker">
              {ponds.map((pond: WorldPond) => (
                <button
                  key={pond.mint}
                  type="button"
                  className={selectedMint === pond.mint ? "pond-choice selected" : "pond-choice"}
                  onClick={() => setSelectedMint(pond.mint)}
                >
                  <strong>{"$" + (pond.symbol || "QUOTE")}</strong>
                  <span>{pond.name || shortAddress(pond.mint)}</span>
                  <small>{pond.creature_count} creatures · {pond.launch_engine === "raydium-cpmm" ? "Raydium pool route" : "Meteora curve"}</small>
                </button>
              ))}
            </div>

            {!loading && ponds.length === 0 && (
              <div className="no-ponds-launch">
                <strong>no ponds are open yet.</strong>
                <Link href="/ponds/new">open the first pond →</Link>
              </div>
            )}

            <Link href="/ponds/new" className="secondary-action">+ open a new pond</Link>
          </div>
        </section>

        <section className="hatch-step">
          <div className="step-number">02</div>
          <div className="step-body">
            <small>CREATURE IDENTITY</small>
            <h2>what are you launching?</h2>

            <div className="creature-form-grid">
              <div>
                <label>
                  <span>name</span>
                  <input value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="Fish" />
                </label>
                <label>
                  <span>ticker</span>
                  <input value={symbol} maxLength={10} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="FISH" />
                </label>
                <label>
                  <span>little note</span>
                  <textarea value={description} maxLength={240} onChange={(e) => setDescription(e.target.value)} placeholder="what lives here?" />
                </label>

                <details className="creature-links">
                  <summary>links · optional</summary>
                  <label><span>website</span><input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></label>
                  <label><span>x</span><input value={xUrl} onChange={(e) => setXUrl(e.target.value)} placeholder="x.com/..." /></label>
                  <label><span>telegram</span><input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="t.me/..." /></label>
                </details>
              </div>

              <label className="image-drop">
                <span>{imageDataUrl ? "picture ready" : "drop a picture here"}</span>
                {imageDataUrl ? <img src={imageDataUrl} alt="creature preview" /> : <div className="image-placeholder">+</div>}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => void onImage(e.target.files?.[0])} />
              </label>
            </div>
          </div>
        </section>

        <section className="hatch-step">
          <div className="step-number">03</div>
          <div className="step-body hatch-final">
            <small>LAUNCH</small>
            <h2>{selected ? (symbol || "CREATURE") + " / " + selected.symbol : "pick a pond first"}</h2>
            <p className="muted">
              {selected?.launch_engine === "raydium-cpmm"
                ? "this pond uses a Raydium pool. p0nd supplies the full 1B creature supply to the initial pool; you choose how much of the pond token seeds the other side."
                : "your wallet pays normal Solana account/rent/network costs and becomes the on-chain creator."}
            </p>

            {selected?.launch_engine === "raydium-cpmm" && (
              <label>
                <span>{"initial liquidity · " + (selected.symbol || "pond token")}</span>
                <input
                  value={seedQuote}
                  onChange={(e) => setSeedQuote(e.target.value)}
                  placeholder={"amount in " + (selected.symbol || "pond token")}
                  inputMode="decimal"
                />
                <small>
                  you need this amount in your wallet. Raydium also charges its on-chain pool-creation cost.
                </small>
              </label>
            )}

            <button
              className="big-hatch"
              type="button"
              disabled={
                Boolean(busy) ||
                !publicKey ||
                !selected ||
                !name.trim() ||
                !symbol.trim() ||
                (selected.launch_engine === "raydium-cpmm" && !seedQuote.trim())
              }
              onClick={() => void hatch()}
            >
              {busy === "hatch"
                ? "HATCHING..."
                : selected?.launch_engine === "raydium-cpmm"
                ? "HATCH + CREATE POOL"
                : "HATCH CREATURE"}
            </button>
          </div>
        </section>

        {launched && (
          <section className="hatched-card">
            <div>
              <small>IT HATCHED</small>
              <h2>{"$" + symbol.toUpperCase()}</h2>
              <p>
                {shortAddress(launched.baseMint, 7)}
                {" · living in $" + (selected?.symbol || "QUOTE")}
              </p>
              <Link href={"/creature/" + launched.baseMint}>visit creature →</Link>
            </div>
            <div className="first-swim">
              <small>OPTIONAL FIRST BUY</small>
              <input value={firstBuy} onChange={(e) => setFirstBuy(e.target.value)} placeholder={"amount in " + (selected?.symbol || "pond token")} />
              <button type="button" disabled={busy === "buy" || !firstBuy.trim()} onClick={() => void firstSwim()}>
                {busy === "buy" ? "BUYING..." : "BUY WITH " + (selected?.symbol || "POND TOKEN")}
              </button>
            </div>
          </section>
        )}

        <div className="lab-message">
          <small>p0nd LOG</small>
          <strong>{message}</strong>
        </div>
      </main>
    </Shell>
  );
}
