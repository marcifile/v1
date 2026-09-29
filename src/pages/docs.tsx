import { Shell } from "@/components/Shell";

const notes = [
  ["01", "pick a pond", "A pond is an existing Solana token used as the quote asset for a creature’s Meteora Dynamic Bonding Curve."],
  ["02", "hatch a creature", "The new token launches against that pond token instead of defaulting to SOL."],
  ["03", "water moves", "Buys put the pond token into the DBC quote reserve. Sells pull it back out. POND draws that reserve as water depth."],
  ["04", "deeper water", "When a pond’s configured quote threshold is reached, the DBC becomes eligible to graduate into a Meteora DAMM v2 pool."],
];

export default function DocsPage() {
  return (
    <Shell>
      <main className="page docs-page">
        <div className="page-title manual-title">
          <span>FIELD MANUAL · V1</span>
          <h1>how it flows</h1>
          <p>the short version, without the brochure language.</p>
        </div>

        <div className="manual-grid">
          {notes.map(([no, title, body]) => (
            <article className="manual-note" key={no}>
              <span>{no}</span>
              <div><h2>{title}</h2><p>{body}</p></div>
            </article>
          ))}
        </div>

        <aside className="manual-warning">
          <strong>DEVNET NOTE</strong>
          <p>V1 is still deliberately locked to devnet. The 1,000 WATER graduation threshold is a test preset, not a mainnet economic decision.</p>
        </aside>
      </main>
    </Shell>
  );
}
