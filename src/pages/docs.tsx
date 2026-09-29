import Link from "next/link";
import { Shell } from "@/components/Shell";

const steps = [
  {
    no: "01",
    title: "pick a pond",
    body:
      "A pond is an existing supported Solana token. It becomes the quote asset for creatures launched inside it.",
    example: "PAID becomes the currency.",
  },
  {
    no: "02",
    title: "hatch a creature",
    body:
      "POND creates a new SPL token and a Meteora Dynamic Bonding Curve that uses the pond token instead of SOL.",
    example: "FROG / PAID, not FROG / SOL.",
  },
  {
    no: "03",
    title: "trade",
    body:
      "Buyers spend the pond token to receive the creature. Sellers return the creature to receive the pond token.",
    example: "100 PAID → FROG → PAID.",
  },
  {
    no: "04",
    title: "water moves",
    body:
      "The quote-token reserve inside the bonding curve is visualized as water. Buys add water. Sells remove it.",
    example: "reserve up = pond deeper.",
  },
  {
    no: "05",
    title: "graduate",
    body:
      "When the configured quote threshold is reached, the DBC becomes eligible to migrate into a Meteora DAMM v2 pool.",
    example: "bonding curve → AMM liquidity.",
  },
];

const faqs = [
  [
    "is the creature a real coin?",
    "Yes. On mainnet it would be a normal SPL token on Solana. Devnet tokens are technically real on-chain assets too, but they have no monetary value.",
  ],
  [
    "does the pond token creator receive every buy?",
    "No. Trading principal sits in the bonding curve reserve so sellers can trade back out. Creator or protocol fee shares are separate configuration.",
  ],
  [
    "can one pond have many creatures?",
    "Yes. That is the point: one quote token can become the local currency for many independent launches.",
  ],
  [
    "are ponds different blockchains?",
    "No. Pond, creature, bonding curve and eventual AMM all stay on Solana. A pond changes the quote token, not the chain.",
  ],
  [
    "why not just use SOL?",
    "Using another token as the quote asset lets a community build markets that circulate back into its own token instead of always exiting into SOL.",
  ],
  [
    "will every token make a good pond?",
    "No. Liquidity, volatility, decimals, market quality and quote-token value all matter. Mainnet pond economics need to be configured per asset.",
  ],
];

export default function DocsPage() {
  return (
    <Shell>
      <main className="page docs-page">
        <div className="page-title manual-title">
          <span>FIELD MANUAL · V1</span>
          <h1>how it flows</h1>
          <p>what a pond is, what a creature is, and where the money actually goes.</p>
        </div>

        <section className="docs-thesis">
          <div>
            <small>THE WHOLE IDEA</small>
            <h2>normally: SOL ↔ coin</h2>
            <h2>pond: token ↔ coin</h2>
          </div>
          <p>
            POND is a Solana launchpad where a new token can use another existing
            Solana token as its market currency. That quote token becomes the
            pond. New launches inside it are creatures.
          </p>
        </section>

        <section className="docs-example">
          <div className="docs-example-token pond-token">
            <small>POND TOKEN</small>
            <strong>$PAID</strong>
            <span>existing SPL token</span>
          </div>
          <div className="docs-example-arrow">→</div>
          <div className="docs-example-token">
            <small>NEW MARKET</small>
            <strong>FROG / PAID</strong>
            <span>real Meteora DBC</span>
          </div>
          <div className="docs-example-arrow">→</div>
          <div className="docs-example-token">
            <small>CREATURE</small>
            <strong>$FROG</strong>
            <span>new SPL token</span>
          </div>
        </section>

        <div className="manual-steps">
          {steps.map((step) => (
            <article className="manual-step" key={step.no}>
              <span>{step.no}</span>
              <div>
                <small>FIELD STEP</small>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
                <strong>{step.example}</strong>
              </div>
            </article>
          ))}
        </div>

        <section className="reserve-diagram">
          <header>
            <small>THE IMPORTANT PART</small>
            <h2>where does a buy go?</h2>
          </header>
          <div className="reserve-track">
            <div><small>WALLET</small><strong>100 PAID</strong></div>
            <b>→ BUY →</b>
            <div className="reserve-vault"><small>DBC QUOTE RESERVE</small><strong>+ PAID</strong><span>this is the water</span></div>
            <b>→ MINTS →</b>
            <div><small>WALLET</small><strong>FROG</strong></div>
          </div>
          <p>
            The PAID is not simply handed to the FROG creator. It remains in the
            curve as trading liquidity. When somebody sells FROG, PAID comes back
            out of that reserve to the seller.
          </p>
        </section>

        <section className="docs-ecosystem">
          <div className="docs-eco-copy">
            <small>ONE POND · MANY MARKETS</small>
            <h2>the quote token becomes the local currency.</h2>
            <p>
              FROG, MOTH, DUCK and SNAIL can all be separate real tokens while
              sharing PAID as their quote asset. Traders move into those markets
              through PAID and return to PAID when they sell.
            </p>
          </div>
          <div className="docs-eco-map">
            <span className="d-e north">$FROG</span>
            <span className="d-e west">$MOTH</span>
            <strong>$PAID</strong>
            <span className="d-e east">$DUCK</span>
            <span className="d-e south">$SNAIL</span>
          </div>
        </section>

        <section className="faq-grid">
          {faqs.map(([q, a]) => (
            <article key={q}>
              <small>QUESTION</small>
              <h3>{q}</h3>
              <p>{a}</p>
            </article>
          ))}
        </section>

        <aside className="manual-warning">
          <strong>DEVNET RIGHT NOW</strong>
          <p>
            The live site currently runs this exact mechanism on Solana devnet.
            WATER and the demo creatures have no monetary value. Mainnet remains
            intentionally locked until graduation thresholds, curve economics,
            fee routing and supported pond requirements are finalized per quote
            asset.
          </p>
        </aside>

        <div className="docs-cta">
          <Link href="/ponds">browse ponds →</Link>
          <Link href="/hatch">hatch a creature →</Link>
        </div>
      </main>
    </Shell>
  );
}
