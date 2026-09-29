import { Shell } from "@/components/Shell";

export default function DocsPage() {
  return (
    <Shell>
      <main className="page prose">
        <div className="page-title"><span>FIELD NOTES</span><h1>how it flows</h1></div>
        <h2>1. pick a pond</h2><p>A pond is an existing Solana token used as the quote asset for a creature's Meteora Dynamic Bonding Curve.</p>
        <h2>2. hatch a creature</h2><p>The new token launches against that pond token instead of defaulting to SOL.</p>
        <h2>3. water moves</h2><p>Buys add quote assets to the DBC quote reserve. Sells remove them. POND visualizes that real reserve as water depth.</p>
        <h2>4. deeper water</h2><p>When the configured migration quote threshold is reached, the DBC becomes eligible to graduate into a Meteora DAMM v2 pool.</p>
        <p className="muted">V1 uses Meteora's public DBC/DAMM v2 primitives. No custom custody contract is planned for the first release.</p>
      </main>
    </Shell>
  );
}
