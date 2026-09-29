import { useEffect, useMemo } from "react";
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

const DEVNET_RPC = "https://api.devnet.solana.com";
const MAINNET_RPC = "https://api.mainnet-beta.solana.com";

export default function App({ Component, pageProps }: AppProps) {
  const cluster = String(
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "mainnet-beta"
  ).toLowerCase();
  const endpoint =
    cluster === "mainnet" || cluster === "mainnet-beta"
      ? MAINNET_RPC
      : DEVNET_RPC;

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  useEffect(() => {
    // Previous versions of p0nd registered a service worker. It can leave stale
    // Next.js HTML/chunks behind after deploys, which makes the page render but
    // leaves buttons inert. Clean it up permanently.
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      });
    }
    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (const key of keys) void caches.delete(key);
      });
    }
  }, []);

  return (
    <>
      <Head>
        <title>p0nd</title>
        <meta
          name="description"
          content="Launch real Solana tokens priced in other Solana tokens."
        />
        <link rel="icon" type="image/svg+xml" href="/pond-mark.svg?v=5" />
        <link rel="apple-touch-icon" href="/p0nd-logo.png?v=5" />
        <meta name="theme-color" content="#0b0d0a" />
        <meta property="og:site_name" content="p0nd" />
        <meta property="og:title" content="p0nd" />
        <meta property="og:image" content="/p0nd-logo.png?v=5" />
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
