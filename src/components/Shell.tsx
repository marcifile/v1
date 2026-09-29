import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/router";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PROJECT, ROUTES } from "@/lib/project";
import { useWorld } from "@/hooks/useWorld";
import { shortAddress } from "@/lib/display";

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { world, error } = useWorld(15000);

  const latest = world?.events?.[0];
  const latestCreature = latest?.creature_mint
    ? world?.creatures.find((c) => c.mint === latest.creature_mint)
    : null;

  const newestSnapshot = world?.creatures
    .map((creature) => creature.snapshot_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const snapshotAge = newestSnapshot
    ? Math.max(
        0,
        Math.round((Date.now() - new Date(newestSnapshot).getTime()) / 1000)
      )
    : null;

  const routeActive = (href: string) => {
    if (router.pathname === href) return true;
    if (href === "/creatures" && router.pathname.startsWith("/creature/")) return true;
    if (href === "/ponds" && router.pathname.startsWith("/pond/")) return true;
    return false;
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="p0nd home">
          <span className="brand-icon"><span className="brand-pixel" /></span>
          <strong>{PROJECT.name}</strong>
        </Link>

        <nav className="topnav">
          {ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={routeActive(route.href) ? "active" : ""}
            >
              {route.label}
            </Link>
          ))}
        </nav>

        <div className="topbar-actions">
          <span className="network-light"><i /> DEVNET</span>
          <span>SND OFF</span>
          {connected && publicKey ? (
            <button type="button" onClick={() => void disconnect()}>
              {shortAddress(publicKey.toBase58(), 4)}
            </button>
          ) : (
            <button type="button" onClick={() => setVisible(true)}>
              Connect
            </button>
          )}
        </div>
      </header>

      <div className="site-body">{children}</div>

      <footer className="global-ticker">
        <div><small>PONDS</small><strong>{world?.ponds.length ?? "—"}</strong></div>
        <div><small>CREATURES</small><strong>{world?.creatures.length ?? "—"}</strong></div>
        <div>
          <small>INDEXER</small>
          <strong>
            {error
              ? "RETRYING"
              : snapshotAge === null
              ? "WAITING"
              : snapshotAge + "s AGO"}
          </strong>
        </div>
        <div className="ticker-wide">
          <small>LATEST RIPPLE</small>
          <strong>
            {latest
              ? latest.type.toUpperCase() +
                (latestCreature ? " · $" + latestCreature.symbol : "")
              : "THE WATER IS QUIET"}
          </strong>
        </div>
        <div className="ticker-live"><i /> {error ? "STALE" : "LIVE"}</div>
      </footer>
    </div>
  );
}
