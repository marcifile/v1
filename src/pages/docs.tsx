import Link from "next/link";
import { Shell } from "@/components/Shell";

const steps = [
  {
    no: "01",
    title: "choose a pond",
    body:
      "A pond is an existing supported Solana token. It becomes the quote asset for every creature launched into that habitat.",
    example: "$PAID becomes the market currency.",
  },
  {
    no: "02",
    title: "hatch a creature",
    body:
      "p0nd creates a new SPL token and a Meteora Dynamic Bonding Curve configured with the pond token as quote.",
    example: "FROG / PAID instead of FROG / SOL.",
  },
  {
    no: "03",
    title: "trade",
    body:
      "Buyers spend the pond token for the creature. Sellers return the creature and receive the pond token back.",
    example: "PAID → FROG → PAID.",
  },
  {
    no: "04",
    title: "watch the water",
    body:
      "Quote reserve inside the DBC is rendered as pond depth. Buys add quote reserve; sells remove it.",
    example: "more PAID in reserve = deeper PAID pond.",
  },
  {
    no: "05",
    title: "graduate",
    body:
      "When quote reserve reaches that pond config's threshold, Meteora can migrate the creature into a DAMM v2 market.",
    example: "DBC price discovery → AMM liquidity.",
  },
];

const faqs = [
  [
    "is a creature a real coin?",
    "Yes. It is a real SPL token and a real Meteora market on the selected Solana cluster. The current site uses devnet, so the assets have no monetary value.",
  ],
  [
    "does the pond token creator receive every buy?",
    "No. Trade principal stays in the bonding curve as quote reserve so sellers can trade back out. Trading fees are separate from that reserve.",
  ],
  [
    "what does the creature creator earn?",
    "The current devnet DBC config allocates 50% of the creator/partner trading-fee share to the creature creator. Because fees are collected in the quote token, a FROG creator in a PAID pond earns claimable PAID.",
  ],
  [
    "can one pond have many creatures?",
    "Yes. That is the core model: one quote token can be the common currency for many independent launches.",
  ],
  [
    "are ponds different blockchains?",
    "No. Pond token, creature token, DBC and graduated market all stay on Solana. A pond changes the quote asset, not the chain.",
  ],
  [
    "why not just use SOL?",
    "Using another token as quote lets a community build markets whose entry and exit asset is its own token instead of routing every launch back through SOL.",
  ],
  [
    "can any random token be a pond?",
    "Not automatically. Devnet v1 currently accepts standard SPL quote mints. A mainnet version needs explicit support checks, liquidity requirements and a sensible graduation value for each quote token.",
  ],
  [
    "does the pond token team automatically receive creature tokens?",
    "No. Using PAID or BONK as a quote asset does not automatically transfer FROG to that token's team, and it does not hand them the creature's quote reserve.",
  ],
  [
    "does a real p0nd market automatically appear on Axiom or DexScreener?",
    "Not guaranteed. The SPL token and Meteora market are real on chain, but third-party terminals decide which pools they index, display and route.",
  ],
  [
    "does the pond token issuer have to create the pond?",
    "The devnet mechanism can register an existing compatible quote mint without changing or controlling that token. Mainnet curation and eligibility policy is deliberately not finalized yet.",
  ],
  [
    "what happens if the website is down?",
    "The on-chain token and Meteora pool do not disappear. The site is an interface and indexer around on-chain markets; Postgres is not the source of truth.",
  ],
];

export default function DocsPage() {
  return (
    <Shell>
      <main className="page docs-page">
        <div className="page-title manual-title">
          <span>FIELD MANUAL · DEVNET V1</span>
          <h1>how it flows</h1>
          <p>
            the mechanics, economics and limits — not just the pond metaphor.
          </p>
        </div>

        <nav className="docs-index">
          <a href="#overview">01 overview</a>
          <a href="#route">02 trading</a>
          <a href="#launch">03 launch</a>
          <a href="#fees">04 fees</a>
          <a href="#graduation">05 graduation</a>
          <a href="#parameters">06 parameters</a>
          <a href="#ponds">07 pond rules</a>
          <a href="#verify">08 verify</a>
          <a href="#risks">09 risks</a>
          <a href="#faq">10 faq</a>
        </nav>

        <section id="overview" className="docs-thesis">
          <div>
            <small>01 · OVERVIEW</small>
            <h2>normally: SOL ↔ coin</h2>
            <h2>pond: token ↔ coin</h2>
          </div>
          <p>
            p0nd is a Solana launchpad where a new token can use another
            existing Solana token as its market currency. The existing quote
            token is the <b>pond</b>. New tokens launched against it are
            <b> creatures</b>.
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
            <small>MARKET</small>
            <strong>FROG / PAID</strong>
            <span>Meteora DBC</span>
          </div>
          <div className="docs-example-arrow">→</div>
          <div className="docs-example-token">
            <small>CREATURE</small>
            <strong>$FROG</strong>
            <span>new SPL token</span>
          </div>
        </section>

        <div id="launch" className="manual-steps">
          {steps.map((step) => (
            <article className="manual-step" key={step.no}>
              <span>{step.no}</span>
              <div>
                <small>LAUNCH FLOW</small>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
                <strong>{step.example}</strong>
              </div>
            </article>
          ))}
        </div>

        <section id="route" className="docs-route">
          <header>
            <small>02 · TRADING ROUTE</small>
            <h2>you need the pond token to buy its creatures.</h2>
          </header>
          <div className="route-track">
            <div><small>START</small><strong>SOL</strong></div>
            <b>→ acquire →</b>
            <div className="route-pond"><small>POND TOKEN</small><strong>PAID</strong></div>
            <b>→ trade DBC →</b>
            <div><small>CREATURE</small><strong>FROG</strong></div>
          </div>
          <p>
            The current devnet UI trades directly once your wallet already has
            the pond token. Automatic SOL → pond routing is not shipped yet.
            That is a UX layer, not a different market: the creature itself is
            still FROG/PAID.
          </p>
        </section>

        <section className="reserve-diagram">
          <header>
            <small>TRADE PRINCIPAL</small>
            <h2>where does a buy go?</h2>
          </header>
          <div className="reserve-track">
            <div><small>BUYER</small><strong>100 PAID</strong></div>
            <b>→ BUY →</b>
            <div className="reserve-vault">
              <small>DBC QUOTE RESERVE</small>
              <strong>+ PAID</strong>
              <span>this is the water</span>
            </div>
            <b>→ RECEIVES →</b>
            <div><small>BUYER</small><strong>FROG</strong></div>
          </div>
          <p>
            The PAID is not handed to the FROG creator. It stays in the curve
            as trading reserve. Selling FROG pulls PAID back out of that reserve
            to the seller.
          </p>
        </section>

        <section id="fees" className="docs-fees">
          <div className="docs-fee-copy">
            <small>04 · CREATOR ECONOMICS</small>
            <h2>trade in a pond. earn the pond token.</h2>
            <p>
              V1 collects DBC trading fees in the quote token. The current test
              config sets a 1% base trading fee and a 50% creator trading-fee
              percentage. That percentage is the DBC split between creator and
              partner after protocol accounting — it is not the same thing as
              saying the creator receives 0.5% of gross volume.
            </p>
            <p>
              The live creature page reads the creator&apos;s unclaimed fee
              balance from Meteora and lets the on-chain creator claim it.
            </p>
          </div>
          <div className="fee-route">
            <div><small>FROG TRADES</small><strong>fee in PAID</strong></div>
            <b>→</b>
            <div className="fee-route-highlight"><small>DBC SPLIT</small><strong>creator share</strong></div>
            <b>→</b>
            <div><small>DEV WALLET</small><strong>claim PAID</strong></div>
          </div>
        </section>

        <section className="docs-ecosystem">
          <div className="docs-eco-copy">
            <small>ONE POND · MANY MARKETS</small>
            <h2>the quote token becomes the local currency.</h2>
            <p>
              FROG, MOTH, DUCK and SNAIL can all be separate real tokens while
              sharing PAID as quote. Someone entering one of those markets needs
              PAID; someone exiting returns to PAID.
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

        <section id="graduation" className="docs-section">
          <header>
            <small>05 · GRADUATION</small>
            <h2>the creature eventually leaves the curve for deeper water.</h2>
          </header>
          <p>
            Meteora DBC tracks quote reserve against a configured migration
            threshold. Once the threshold is reached, the pool is eligible for
            migration to DAMM v2. The current WATER threshold is intentionally
            tiny for devnet testing; a mainnet PAID/BONK/etc. pond needs a
            threshold based on the value and liquidity of that quote token.
          </p>
        </section>

        <section id="parameters" className="parameter-sheet">
          <header>
            <small>06 · CURRENT DEVNET PRESET</small>
            <strong>READ THIS AS A TEST CONFIG, NOT FINAL MAINNET ECONOMICS</strong>
          </header>
          <div className="parameter-row"><span>creature supply</span><strong>1,000,000,000</strong></div>
          <div className="parameter-row"><span>creature decimals</span><strong>6</strong></div>
          <div className="parameter-row"><span>base trading fee</span><strong>1.00%</strong></div>
          <div className="parameter-row"><span>creator trading-fee percentage</span><strong>50%</strong></div>
          <div className="parameter-row"><span>fee collection</span><strong>quote token</strong></div>
          <div className="parameter-row"><span>WATER graduation threshold</span><strong>1,000 WATER</strong></div>
          <div className="parameter-row"><span>supply on migration</span><strong>20%</strong></div>
          <div className="parameter-row"><span>migration target</span><strong>Meteora DAMM v2</strong></div>
          <div className="parameter-row"><span>devnet network/rent</span><strong>sponsored by p0nd</strong></div>
        </section>

        <section id="ponds" className="docs-section">
          <header>
            <small>07 · WHAT CAN BECOME A POND?</small>
            <h2>registration is not the same as creating the pond token.</h2>
          </header>
          <p>
            A pond token already exists before p0nd sees it. Registering a pond
            simply creates/reuses the DBC configuration that lets future
            creatures quote against that mint. Devnet v1 currently supports
            standard SPL quote mints. Mainnet should additionally require
            liquidity, a reliable price source and compatibility with Meteora
            quote-token requirements before a pond opens for launches.
          </p>
        </section>

        <section id="verify" className="docs-section verify-section">
          <header>
            <small>08 · SOURCE OF TRUTH</small>
            <h2>the market lives on chain; the database is an index.</h2>
          </header>
          <div className="verify-grid">
            <div><small>METEORA</small><strong>pool, reserve, fees, migration state</strong></div>
            <div><small>SOLANA</small><strong>mints, balances, signatures</strong></div>
            <div><small>IPFS / PINATA</small><strong>creature image + metadata</strong></div>
            <div><small>POSTGRES</small><strong>searchable cache + history</strong></div>
            <div><small>INDEXER</small><strong>refreshes chain snapshots ~12s</strong></div>
          </div>
        </section>

        <section id="risks" className="docs-section risk-section">
          <header>
            <small>09 · RISKS / HONEST LIMITS</small>
            <h2>different quote tokens create different markets.</h2>
          </header>
          <ul>
            <li>A weak or illiquid pond token makes every creature inside it harder to trade.</li>
            <li>Quote-token volatility changes the real-world value of a creature&apos;s graduation threshold.</li>
            <li>Liquidity can fragment when many different quote tokens are used.</li>
            <li>Current devnet buyers need to already hold the pond token; automatic routing is not shipped yet.</li>
            <li>Meteora programs and SDK behavior are external dependencies.</li>
            <li>The index can lag briefly; the blockchain remains authoritative.</li>
          </ul>
        </section>

        <section id="faq" className="faq-grid">
          {faqs.map(([q, a]) => (
            <article key={q}>
              <small>10 · FAQ</small>
              <h3>{q}</h3>
              <p>{a}</p>
            </article>
          ))}
        </section>

        <aside className="manual-warning">
          <strong>DEVNET RIGHT NOW</strong>
          <p>
            WATER and the demo creatures have no monetary value. Mainnet remains
            intentionally locked until pond eligibility, graduation sizing,
            post-graduation liquidity ownership and fee routing are finalized.
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
