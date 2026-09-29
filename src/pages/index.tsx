import Head from "next/head";
import { Shell } from "@/components/Shell";
import { WorldFrame } from "@/components/WorldFrame";

export default function Home() {
  return (
    <>
      <Head>
        <title>pond — coins living in other coins</title>
        <meta
          name="description"
          content="A living Solana launchpad where coins live in other coins."
        />
      </Head>
      <Shell>
        <main className="home">
          <WorldFrame />
        </main>
      </Shell>
    </>
  );
}
