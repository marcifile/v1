import Link from "next/link";
import type { WorldPayload } from "@/types/world";
import { formatBaseUnits } from "@/lib/display";

export function ConceptExplainer({ world }: { world: WorldPayload | null }) {
  const ponds = world?.ponds ?? [];
  const creatures = world?.creatures ?? [];
  const firstPond = ponds[0] ?? null;
  const residents = firstPond
    ? creatures.filter((creature) => creature.pond_mint === firstPond.mint)
    : [];

  return (
    <div className="concept-stack">
      <section className="concept-intro">
        <div className="concept-copy">
          <span>SO WHAT IS p0nd?</span>
          <h2>turn a token into an economy.</h2>
          <p>
            Usually a new coin launches against SOL. On p0nd, it can launch against an existing pond token instead.
          </p>
        </div>

        <div className="pair-compare">
          <div className="pair-card ordinary">
            <small>USUAL LAUNCH</small>
            <div className="pair-line">
              <strong>SOL</strong><i>↔</i><strong>FROG</strong>
            </div>
            <p>the new coin is priced in SOL.</p>
          </div>
          <div className="pair-arrow">→</div>
          <div className="pair-card pond-pair">
            <small>ON p0nd</small>
            <div className="pair-line">
              <strong>POND</strong><i>↔</i><strong>FROG</strong>
            </div>
            <p>the new coin is priced in POND.</p>
          </div>
        </div>
      </section>

      <section className="concept-grid">
        <article className="explain-card pond-definition">
          <span className="explain-no">01</span>
          <small>THE POND</small>
          <h3>an existing token</h3>
          <p>
            A pond starts with an existing coin. Paste its CA once, and that coin becomes the quote asset for creatures launched inside the pond.
          </p>
          <div className="pond-orbit">
            <div className="pond-core">$POND</div>
            <span className="orbit-creature o1">$FROG</span>
            <span className="orbit-creature o2">$MOTH</span>
            <span className="orbit-creature o3">$DUCK</span>
          </div>
        </article>

        <article className="explain-card creature-definition">
          <span className="explain-no">02</span>
          <small>THE CREATURE</small>
          <h3>a new real token</h3>
          <p>
            A creature is a newly created SPL token on the same Solana chain.
            The only unusual part is what it trades against.
          </p>
          <div className="token-slip">
            <div><small>NEW TOKEN</small><strong>$FROG</strong></div>
            <div><small>CHAIN</small><strong>SOLANA</strong></div>
            <div><small>MARKET</small><strong>FROG / POND</strong></div>
          </div>
        </article>
      </section>

      <section className="water-explainer">
        <header>
          <span>WHERE DOES THE POND TOKEN GO?</span>
          <h2>into the market, not the creator&apos;s pocket.</h2>
        </header>

        <div className="flow-rail">
          <div className="flow-node">
            <small>BUYER</small>
            <strong>100 POND</strong>
          </div>
          <div className="flow-step">
            <span>BUY FROG</span><b>→</b>
          </div>
          <div className="flow-node reserve-node">
            <small>DBC RESERVE</small>
            <strong>≈99 POND</strong>
            <i>the pond gets deeper</i>
          </div>
          <div className="flow-step">
            <span>RECEIVES</span><b>→</b>
          </div>
          <div className="flow-node">
            <small>BUYER</small>
            <strong>FROG</strong>
          </div>
        </div>

        <p className="flow-footnote">
          Trading principal sits in the creature market as quote liquidity or reserve. Sells send the pond token back out to sellers. Trading fees are separate.
        </p>
      </section>

      <section className="why-pond">
        <div className="why-copy">
          <span>WHY?</span>
          <h2>the parent token becomes the local currency.</h2>
          <p>
            If people want a creature in the POND pond, they need POND. When
            they sell the creature, they come back out into POND. Instead of
            every ecosystem token orbiting SOL, a community can have markets
            that actually orbit its own token.
          </p>
          <Link href="/docs">read the full field manual →</Link>
        </div>

        <div className="ecosystem-diagram">
          <div className="eco-token north">$FROG</div>
          <div className="eco-token west">$SNAIL</div>
          <div className="eco-core">
            <small>POND</small>
            <strong>$POND</strong>
          </div>
          <div className="eco-token east">$DUCK</div>
          <div className="eco-token south">$MOTH</div>
          <span className="eco-line n" />
          <span className="eco-line w" />
          <span className="eco-line e" />
          <span className="eco-line s" />
        </div>
      </section>

      <section className="gravity-strip">
        <div>
          <small>THE STRONGEST LOOP</small>
          <h2>enter through POND. exit back into POND.</h2>
        </div>
        <div className="gravity-flow">
          <span>SOL</span><b>→</b><strong>POND</strong><b>→</b><span>FROG</span><b>→</b><strong>POND</strong>
        </div>
        <p>
          A creature does not magically guarantee demand for its pond token.
          But every market inside the pond uses that token as its trading
          currency, so the whole ecosystem shares one common entry and exit
          asset instead of routing everything back through SOL.
        </p>
      </section>

      <section className="creator-economics">
        <div className="creator-economics-copy">
          <small>CREATOR ECONOMICS</small>
          <h2>build in a pond. earn in the pond token.</h2>
          <p>
            Each creature is a real Solana market. p0nd uses Meteora DBC where the pond token is natively supported and a Raydium CPMM route for compatible fallback tokens. Fee behavior depends on the launch route, and the market always trades against its pond token.
          </p>
          <span>
            market reserves and trading fees are separate things; the exact accounting depends on the launch route.
          </span>
        </div>
        <div className="fee-loop">
          <div><small>TRADERS</small><strong>FROG ↔ POND</strong></div>
          <b>→</b>
          <div className="fee-jar"><small>CREATOR FEE JAR</small><strong>POND</strong></div>
          <b>→</b>
          <div><small>CREATOR</small><strong>CLAIM POND</strong></div>
        </div>
      </section>

      <section className="who-pond">
        <header>
          <span>WHO IS THIS FOR?</span>
          <h2>three different reasons to care.</h2>
        </header>
        <div className="who-grid">
          <article>
            <small>POND COMMUNITIES</small>
            <h3>make your token useful as a market currency.</h3>
            <p>
              Instead of every related launch pairing back to SOL, multiple
              independent markets can use the same pond token as their common
              quote asset.
            </p>
          </article>
          <article>
            <small>CREATURE CREATORS</small>
            <h3>launch inside an existing token economy.</h3>
            <p>
              Pick a supported pond, create a real SPL token, and launch its market against the pond token using the compatible route.
            </p>
          </article>
          <article>
            <small>TRADERS</small>
            <h3>move between a creature and its pond.</h3>
            <p>
              Buy with the pond token and receive the creature. Sell the
              creature and receive the pond token back. The reserve is visible
              as water depth.
            </p>
          </article>
        </div>
      </section>

      <section className="quick-facts">
        <header>
          <span>THE SYSTEM, ON PAPER</span>
          <h2>quick facts.</h2>
        </header>
        <div className="facts-grid">
          <div><small>CHAIN</small><strong>Solana</strong></div>
          <div><small>LAUNCH MARKET</small><strong>Meteora DBC / Raydium CPMM</strong></div>
          <div><small>QUOTE ASSET</small><strong>the pond token</strong></div>
          <div><small>ROUTE</small><strong>chosen by token compatibility</strong></div>
          <div><small>METADATA</small><strong>IPFS / Pinata</strong></div>
          <div><small>WORLD STATE</small><strong>indexed from chain</strong></div>
          <div><small>ONE POND</small><strong>many creatures</strong></div>
          <div><small>NETWORK</small><strong>mainnet</strong></div>
        </div>
        <p>
          A real on-chain market does not guarantee that every third-party
          terminal will display the pair. Axiom, DexScreener, Jupiter and other
          interfaces each decide what markets they index and route.
        </p>
      </section>

      <section className="live-proof">
        <header>
          <div>
            <span>THIS POND RIGHT NOW</span>
            <h2>live pond state.</h2>
          </div>
          <Link href="/hatch">hatch something →</Link>
        </header>

        <div className="proof-grid">
          <div>
            <small>PONDS</small>
            <strong>{ponds.length}</strong>
            <span>registered quote-token habitats</span>
          </div>
          <div>
            <small>CREATURES</small>
            <strong>{creatures.length}</strong>
            <span>creatures in live ponds</span>
          </div>
          <div>
            <small>{firstPond ? "$" + firstPond.symbol + " WATER" : "WATER"}</small>
            <strong>
              {firstPond
                ? formatBaseUnits(
                    firstPond.quote_reserve_base_units,
                    firstPond.quote_decimals,
                    2
                  )
                : "0"}
            </strong>
            <span>quote reserve across its creatures</span>
          </div>
          <div>
            <small>RESIDENTS</small>
            <strong>{residents.length}</strong>
            <span>{firstPond ? "living in $" + firstPond.symbol : "waiting for a pond"}</span>
          </div>
        </div>

        <p className="devnet-explain">
          pond and creature state is indexed from chain. wallet prompts are the source of truth for anything you sign.
        </p>
      </section>
    </div>
  );
}
