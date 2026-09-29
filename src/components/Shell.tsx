import Link from "next/link";
import type { ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PROJECT, ROUTES } from "@/lib/project";

function shortAddress(address: string) {
  return address.slice(0, 4) + "…" + address.slice(-4);
}

export function Shell({ children }: { children: ReactNode }) {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <span className="brand-icon">◌</span>
          <strong>{PROJECT.name}</strong>
        </Link>
        <nav>
          {ROUTES.map((route) => (
            <Link key={route.href} href={route.href}>{route.label}</Link>
          ))}
        </nav>
        <div className="topbar-actions">
          <span>DEVNET</span>
          <span>SND OFF</span>
          {connected && publicKey ? (
            <button type="button" onClick={() => void disconnect()}>
              {shortAddress(publicKey.toBase58())}
            </button>
          ) : (
            <button type="button" onClick={() => setVisible(true)}>
              Connect
            </button>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
