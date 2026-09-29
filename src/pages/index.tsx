import Head from "next/head";
import { Shell } from "@/components/Shell";
import { WorldFrame } from "@/components/WorldFrame";
import { ConceptExplainer } from "@/components/ConceptExplainer";
import { useWorld } from "@/hooks/useWorld";

export default function Home() {
  const { world } = useWorld(10000);

  return (
    <>
      <Head>
        <title>p0nd — launch coins inside other token economies</title>
        <meta
          name="description"
          content="Launch real Solana tokens priced in other Solana tokens. Each quote-token ecosystem becomes a pond."
        />
      </Head>
      <Shell>
        <main className="home">
          <WorldFrame />
          <ConceptExplainer world={world} />
        </main>
      </Shell>
    </>
  );
}
