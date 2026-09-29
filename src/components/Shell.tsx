import Link from "next/link";
import type { ReactNode } from "react";
import { PROJECT, ROUTES } from "@/lib/project";

export function Shell({ children }: { children: ReactNode }) {
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
          <span>SND OFF</span>
          <button type="button">Connect</button>
        </div>
      </header>
      {children}
    </div>
  );
}
