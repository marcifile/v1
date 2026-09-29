import Head from "next/head";
import { Shell } from "@/components/Shell";
import { WorldFrame } from "@/components/WorldFrame";
import { creatures, ponds } from "@/lib/mock";

export default function Home() {
  return (
    <>
      <Head>
        <title>pond — coins living in other coins</title>
        <meta name="description" content="Coins living in other coins." />
      </Head>
      <Shell>
        <main className="home">
          <WorldFrame />
          <footer className="statusbar">
            <div><small>PONDS</small><strong>{ponds.length}</strong></div>
            <div><small>CREATURES</small><strong>{creatures.length}</strong></div>
            <div><small>WATER</small><strong>live soon</strong></div>
            <div><small>ACTIVE</small><strong>{creatures.filter((c) => c.state !== "sleeping").length}</strong></div>
            <div className="wide"><small>SOLANA</small><strong>devnet foundation</strong></div>
            <div className="wide"><small>LATEST</small><strong>something just hatched</strong></div>
          </footer>
        </main>
      </Shell>
    </>
  );
}
