import Link from "next/link";
import { Shell } from "@/components/Shell";
import { creatures, ponds } from "@/lib/mock";

export default function CreaturesPage() {
  return (
    <Shell>
      <main className="page">
        <div className="page-title"><span>FIELD GUIDE</span><h1>creatures</h1><p>everything currently swimming.</p></div>
        <div className="tabs"><button>New</button><button>Busy</button><button>Deep Ponds</button><button>Near Graduation</button><button>Mine</button></div>
        <div className="guide-grid">
          {creatures.map((c, i) => {
            const pond = ponds.find((p) => p.mint === c.pondMint);
            return (
              <Link className="field-card" key={c.mint} href={"/creature/" + c.mint}>
                <small>{"NO. " + String(i + 1).padStart(4, "0")}</small>
                <div className="field-sprite">{c.species === "frog" ? "●" : c.species === "fish" ? "◆" : "⬡"}</div>
                <h2>{"$" + c.symbol}</h2>
                <p>{"living in $" + (pond?.symbol ?? "?")}</p>
                <dl>
                  <div><dt>mcap</dt><dd>{"$" + Math.round(c.marketCapUsd).toLocaleString()}</dd></div>
                  <div><dt>24h volume</dt><dd>{"$" + Math.round(c.volume24hUsd).toLocaleString()}</dd></div>
                  <div><dt>water</dt><dd>{Math.round(c.quoteReserve).toLocaleString()} {pond?.symbol}</dd></div>
                  <div><dt>depth</dt><dd>{Math.round(c.graduationProgress * 100)}%</dd></div>
                </dl>
              </Link>
            );
          })}
        </div>
      </main>
    </Shell>
  );
}
