import { useMemo } from "react";
import type { AppProps } from "next/app";
import Head from "next/head";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WorldProvider } from "@/hooks/useWorld";
import "@solana/wallet-adapter-react-ui/styles.css";
import "@/styles/globals.css";

const FALLBACK_DEVNET_RPC = "https://api.devnet.solana.com";

export default function App({ Component, pageProps }: AppProps) {
  const endpoint =
    process.env.NEXT_PUBLIC_DEVNET_RPC_URL || FALLBACK_DEVNET_RPC;

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <>
      <Head>
        <title>pond — coins living in other coins</title>
        <meta
          name="description"
          content="Launch real Solana tokens priced in other Solana tokens."
        />
        <link rel="icon" href="/pond-mark.svg" />
        <meta name="theme-color" content="#d5d5c7" />
        <meta property="og:site_name" content="pond" />
      </Head>
      <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WorldProvider>
            <Component {...pageProps} />
          </WorldProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
    </>
  );
}
