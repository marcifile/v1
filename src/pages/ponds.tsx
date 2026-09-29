import { Shell } from "@/components/Shell";
import { ponds } from "@/lib/mock";

export default function PondsPage() {
  return (
    <Shell>
      <main className="page">
        <div className="page-title"><span>HABITATS</span><h1>ponds</h1><p>tokens that creatures can live in.</p></div>
        <div className="guide-grid">
          {ponds.map((pond, i) => (
            <article className="field-card" key={pond.mint}>
              <small>{"POND " + String(i + 1).padStart(3, "0")}</small>
              <div className="pond-circle">~</div>
              <h2>{"$" + pond.symbol}</h2>
              <p>{pond.name}</p>
              <dl>
                <div><dt>creatures</dt><dd>{pond.creatureCount}</dd></div>
                <div><dt>water observed</dt><dd>{pond.quoteReserve.toLocaleString()}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </main>
    </Shell>
  );
}
