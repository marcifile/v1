import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Keypair, Transaction } from "@solana/web3.js";
import { useRouter } from "next/router";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Shell } from "@/components/Shell";
import { useWorld } from "@/hooks/useWorld";
import type { WorldPond } from "@/types/world";
import { shortAddress } from "@/lib/display";

type Launched = {
  baseMint: string;
  pool: string;
  metadataUri: string;
};

type PondInspection = {
  mint: string;
  cluster: string;
  tokenProgram: string;
  decimals: number;
  name: string | null;
  symbol: string | null;
  imageUri: string | null;
  tokenBadgeExists: boolean;
  launchSupportedNow: boolean;
  warnings: string[];
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
  const { setVisible } = useWalletModal();
  const { world, loading, error, refresh } = useWorld(10000);

  const [selectedMint, setSelectedMint] = useState("");
  const [pondMint, setPondMint] = useState("");
  const [pondSymbol, setPondSymbol] = useState("");
  const [pondName, setPondName] = useState("");
  const [pondInspection, setPondInspection] = useState<PondInspection | null>(null);
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [firstBuy, setFirstBuy] = useState("10");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("pick some water.");
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

  const prepareWater = async () => {
    if (!publicKey) return setVisible(true);
    setBusy("water");
    setMessage("filling the little test pond...");
    try {
      const response = await fetch("/api/devnet/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: publicKey.toBase58() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare WATER.");
      await refresh();
      setSelectedMint(data.quoteMint);
      setMessage(
        "WATER is ready · 1,000,000 test WATER is in your wallet."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not prepare WATER.");
    } finally {
      setBusy("");
    }
  };

  const inspectPond = async () => {
    if (!pondMint.trim()) {
      setMessage("paste a devnet token mint first.");
      return null;
    }

    setBusy("inspect-pond");
    setMessage("reading that token from devnet...");
    try {
      const response = await fetch(
        "/api/tokens/inspect?cluster=devnet&mint=" +
          encodeURIComponent(pondMint.trim()),
        { cache: "no-store" }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not inspect token.");
      }

      const inspected = data as PondInspection;
      setPondInspection(inspected);
      if (inspected.symbol) setPondSymbol(inspected.symbol.toUpperCase());
      if (inspected.name) setPondName(inspected.name);
      setMessage(
        inspected.launchSupportedNow
          ? "token verified · it can be used as a devnet pond."
          : "token found, but this v1 launch path does not support it yet."
      );
      return inspected;
    } catch (err) {
      setPondInspection(null);
      setMessage(err instanceof Error ? err.message : "Could not inspect token.");
      return null;
    } finally {
      setBusy("");
    }
  };

  const registerPond = async () => {
    if (!pondMint.trim()) {
      setMessage("paste a devnet token mint first.");
      return;
    }
    let inspected = pondInspection;
    if (!inspected || inspected.mint !== pondMint.trim()) {
      inspected = await inspectPond();
    }
    if (!inspected || !inspected.launchSupportedNow) {
      return;
    }

    setBusy("pond");
    setMessage("opening that token as a pond...");
    try {
      const response = await fetch("/api/ponds/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mint: pondMint.trim(),
          symbol: pondSymbol.trim() || "QUOTE",
          name: pondName.trim() || "Pond",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not register pond.");
      await refresh();
      setSelectedMint(data.pond.mint);
      setMessage(
        data.created
          ? "$" + data.pond.symbol + " is now a pond."
          : "$" + data.pond.symbol + " was already here."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not register pond.");
    } finally {
      setBusy("");
    }
  };

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
    if (!publicKey || !signTransaction) return setVisible(true);
    if (!selected) {
      setMessage("choose a pond first.");
      return;
    }
    if (!name.trim() || !symbol.trim()) {
      setMessage("your creature needs a name and ticker.");
      return;
    }

    setBusy("hatch");
    setMessage("the egg is moving...");
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
          imageDataUrl: imageDataUrl || undefined,
        }),
      });
      const metadata = await metaResponse.json();
      if (!metaResponse.ok) {
        throw new Error(metadata.error || "Could not publish metadata.");
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
      if (!createResponse.ok) {
        throw new Error(built.error || "Could not build launch.");
      }

      const tx = Transaction.from(Buffer.from(built.transaction, "base64"));
      const launchSignature = await sendPartiallySigned(tx, baseMint);

      const registerResponse = await fetch("/api/creatures/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseMint: built.baseMint,
          creator: publicKey.toBase58(),
          name,
          symbol,
          description,
          metadataUri: metadata.metadataUri,
          imageUri: metadata.imageUri,
          launchTx: launchSignature,
          pondName: selected.name,
          pondSymbol: selected.symbol,
        }),
      });
      const registered = await registerResponse.json();
      if (!registerResponse.ok) {
        throw new Error(
          "Launched on-chain, but POND indexing failed: " +
            (registered.error || "unknown error")
        );
      }

      setLaunched({
        baseMint: built.baseMint,
        pool: built.pool,
        metadataUri: metadata.metadataUri,
      });
      await refresh();
      setMessage(
        "$" +
          symbol.trim().toUpperCase() +
          " just hatched in $" +
          (selected.symbol || "QUOTE") +
          "."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Hatch failed.");
    } finally {
      setBusy("");
    }
  };

  const firstSwim = async () => {
    if (!publicKey || !signTransaction || !launched) return;
    setBusy("buy");
    setMessage("first splash...");
    try {
      const response = await fetch("/api/dbc/swap", {
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
      const signature = await sendPartiallySigned(tx);

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
        "first swim complete · " +
          firstBuy +
          " " +
          (selected?.symbol || "QUOTE") +
          " made a splash."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "First swim failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Shell>
      <main className="page hatch-public">
        <div className="page-title">
          <span>HATCHERY · DEVNET PREVIEW</span>
          <h1>hatch a creature</h1>
          <p>pick the water it lives in, give it a name, then let it swim.</p>
        </div>

        {!publicKey && (
          <section className="hatch-step hatch-connect">
            <small>YOU&apos;RE STANDING ON THE DOCK</small>
            <h2>connect first</h2>
            <button type="button" onClick={() => setVisible(true)}>
              Step onto the dock
            </button>
          </section>
        )}

        <section className="hatch-step">
          <div className="step-number">01</div>
          <div className="step-body">
            <small>CHOOSE THE WATER</small>
            <h2>where does it live?</h2>
            <p className="muted">
              {loading
                ? "looking for ponds..."
                : error ||
                  "each pond is a real quote token + Meteora DBC config."}
            </p>

            <div className="pond-picker">
              {ponds.map((pond: WorldPond) => (
                <button
                  key={pond.mint}
                  type="button"
                  className={
                    selectedMint === pond.mint
                      ? "pond-choice selected"
                      : "pond-choice"
                  }
                  onClick={() => setSelectedMint(pond.mint)}
                >
                  <strong>{"$" + (pond.symbol || "QUOTE")}</strong>
                  <span>{pond.name || shortAddress(pond.mint)}</span>
                  <small>{pond.creature_count} creatures</small>
                </button>
              ))}
            </div>

            <div className="hatch-inline-actions">
              <button
                type="button"
                disabled={busy === "water" || !publicKey}
                onClick={prepareWater}
              >
                {busy === "water" ? "filling..." : "Use test WATER"}
              </button>
            </div>

            <details className="register-pond">
              <summary>register an existing devnet token as a pond</summary>
              <p className="register-note">
                this does not mint a new pond token. it verifies an existing token,
                then creates or reuses the Meteora DBC config creatures can launch against.
              </p>
              <div className="register-grid">
                <input
                  placeholder="token mint"
                  value={pondMint}
                  onChange={(e) => {
                    setPondMint(e.target.value);
                    setPondInspection(null);
                  }}
                />
                <input
                  placeholder="ticker"
                  value={pondSymbol}
                  onChange={(e) => setPondSymbol(e.target.value.toUpperCase())}
                />
                <input
                  placeholder="name"
                  value={pondName}
                  onChange={(e) => setPondName(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy === "inspect-pond" || busy === "pond"}
                  onClick={() => void inspectPond()}
                >
                  {busy === "inspect-pond" ? "reading..." : "Inspect token"}
                </button>
              </div>

              {pondInspection && (
                <div className="pond-inspection">
                  <div className="pond-inspection-image">
                    {pondInspection.imageUri ? (
                      <img src={pondInspection.imageUri} alt="" />
                    ) : (
                      <span className="pond-inspection-mark">~</span>
                    )}
                  </div>
                  <dl>
                    <div>
                      <dt>token</dt>
                      <dd>{pondInspection.name || "unknown"} · {"$" + (pondInspection.symbol || "?")}</dd>
                    </div>
                    <div><dt>program</dt><dd>{pondInspection.tokenProgram}</dd></div>
                    <div><dt>decimals</dt><dd>{pondInspection.decimals}</dd></div>
                    <div><dt>dbc badge</dt><dd>{pondInspection.tokenBadgeExists ? "present" : "not detected"}</dd></div>
                    <div><dt>v1 launch</dt><dd>{pondInspection.launchSupportedNow ? "supported" : "not supported"}</dd></div>
                  </dl>
                  {pondInspection.warnings.length > 0 && (
                    <ul>
                      {pondInspection.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    disabled={!pondInspection.launchSupportedNow || busy === "pond"}
                    onClick={registerPond}
                  >
                    {busy === "pond" ? "opening pond..." : "Register this pond"}
                  </button>
                </div>
              )}
            </details>
          </div>
        </section>

        <section className="hatch-step">
          <div className="step-number">02</div>
          <div className="step-body">
            <small>WHO MOVED IN?</small>
            <h2>your creature</h2>

            <div className="creature-form-grid">
              <div>
                <label>
                  <span>name</span>
                  <input
                    value={name}
                    maxLength={32}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Frog"
                  />
                </label>
                <label>
                  <span>ticker</span>
                  <input
                    value={symbol}
                    maxLength={10}
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    placeholder="FROG"
                  />
                </label>
                <label>
                  <span>little note</span>
                  <textarea
                    value={description}
                    maxLength={240}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="sleeps under the lily pads."
                  />
                </label>
              </div>

              <label className="image-drop">
                <span>{imageDataUrl ? "picture ready" : "drop a picture here"}</span>
                {imageDataUrl ? (
                  <img src={imageDataUrl} alt="creature preview" />
                ) : (
                  <div className="image-placeholder">+</div>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => void onImage(e.target.files?.[0])}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="hatch-step">
          <div className="step-number">03</div>
          <div className="step-body hatch-final">
            <small>HATCH</small>
            <h2>
              {selected
                ? "into $" + (selected.symbol || "QUOTE")
                : "pick a pond first"}
            </h2>
            <p className="muted">
              Phantom signs ownership. Devnet network/rent fees are sponsored
              in this preview.
            </p>
            <button
              className="big-hatch"
              type="button"
              disabled={
                Boolean(busy) ||
                !publicKey ||
                !selected ||
                !name.trim() ||
                !symbol.trim()
              }
              onClick={hatch}
            >
              {busy === "hatch" ? "hatching..." : "Hatch creature"}
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
              <Link href={"/creature/" + launched.baseMint}>
                visit creature →
              </Link>
            </div>

            <div className="first-swim">
              <small>FIRST SWIM · OPTIONAL</small>
              <input
                value={firstBuy}
                onChange={(e) => setFirstBuy(e.target.value)}
              />
              <button
                type="button"
                disabled={busy === "buy"}
                onClick={firstSwim}
              >
                {busy === "buy"
                  ? "splashing..."
                  : "Buy with " + (selected?.symbol || "quote")}
              </button>
            </div>
          </section>
        )}

        <div className="lab-message">
          <small>POND LOG</small>
          <strong>{message}</strong>
        </div>

        <p className="dev-lab-link">
          <Link href="/lab">open old devnet lab →</Link>
        </p>
      </main>
    </Shell>
  );
}
