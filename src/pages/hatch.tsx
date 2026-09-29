import { Shell } from "@/components/Shell";

export default function HatchPage() {
  return (
    <Shell>
      <main className="page narrow">
        <div className="page-title"><span>HATCHERY</span><h1>hatch something</h1><p>pick where it lives, then give it a name.</p></div>
        <form className="hatch-form" onSubmit={(e) => e.preventDefault()}>
          <label><span>01 · choose the water</span><input placeholder="paste pond / quote token mint" /></label>
          <label><span>02 · creature name</span><input placeholder="Frog" /></label>
          <label><span>ticker</span><input placeholder="FROG" /></label>
          <label><span>image</span><input type="file" /></label>
          <label><span>first swim</span><input placeholder="optional first buy" /></label>
          <button type="submit">Hatch</button>
          <p className="muted">devnet wiring comes next. no fake launch is submitted from this form yet.</p>
        </form>
      </main>
    </Shell>
  );
}
