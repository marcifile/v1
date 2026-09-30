import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function usePondWalletConnect() {
  const {
    wallet,
    wallets,
    select,
    connect,
    connected,
    connecting,
    publicKey,
    signTransaction,
  } = useWallet();
  const { setVisible } = useWalletModal();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!pending) return;
    if (connected) {
      setPending(false);
      return;
    }
    if (!wallet || connecting) return;

    let cancelled = false;
    void connect()
      .catch(() => {
        if (!cancelled) setVisible(true);
      })
      .finally(() => {
        if (!cancelled) setPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pending, wallet, connecting, connected, connect, setVisible]);

  const connectWallet = useCallback(() => {
    if (connected) return;

    if (wallet) {
      setPending(true);
      return;
    }

    const installed =
      wallets.find(
        (candidate) =>
          String(candidate.readyState) === "Installed" &&
          String(candidate.adapter.name).toLowerCase().includes("phantom")
      ) ||
      wallets.find(
        (candidate) => String(candidate.readyState) === "Installed"
      );

    if (installed) {
      select(installed.adapter.name);
      setPending(true);
      return;
    }

    setVisible(true);
  }, [connected, wallet, wallets, select, setVisible]);

  return {
    connectWallet,
    walletConnecting: connecting || pending,
    connected,
    publicKey,
    signTransaction,
  };
}
