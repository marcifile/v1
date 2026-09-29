import { Shell } from "@/components/Shell";

export default function LogPage() {
  return (
    <Shell>
      <main className="page prose">
        <div className="page-title"><span>FIELD NOTES</span><h1>log</h1></div>
        <article><time>SEP 29</time><h2>the pond exists.</h2><p>foundation repo, real Meteora dependencies, Railway-ready Next app, and the first world shell are in.</p></article>
        <article><time>NEXT</time><h2>connect the water.</h2><p>first real DBC config, devnet launch, buy, sell, and quote-reserve reads.</p></article>
      </main>
    </Shell>
  );
}
