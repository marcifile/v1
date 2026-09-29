import { Connection, PublicKey } from "@solana/web3.js";

const FALLBACK_DEVNET_RPC = "https://api.devnet.solana.com";
const FALLBACK_MAINNET_RPC = "https://api.mainnet-beta.solana.com";

export type P0ndCluster = "devnet" | "mainnet";

export const POND_PROJECT_WALLET = new PublicKey(
  process.env.POND_PROJECT_WALLET ||
    "o1JFNnUtjJaapQrBYszwpoQhkiwn9DkfpQ6UAQztXbv"
);

export function getActiveCluster(): P0ndCluster {
  const raw = String(process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet").toLowerCase();
  return raw === "mainnet" || raw === "mainnet-beta" ? "mainnet" : "devnet";
}

export function isMainnet() {
  return getActiveCluster() === "mainnet";
}

export function assertDevnet() {
  if (getActiveCluster() !== "devnet") {
    throw new Error("This endpoint is available only in the private devnet lab.");
  }
}

export function getRpcUrl(cluster: P0ndCluster) {
  if (cluster === "mainnet") {
    return process.env.MAINNET_RPC_URL || FALLBACK_MAINNET_RPC;
  }
  return process.env.DEVNET_RPC_URL || FALLBACK_DEVNET_RPC;
}

export function getReadOnlyConnection(cluster: P0ndCluster) {
  return new Connection(getRpcUrl(cluster), "confirmed");
}

export function getServerConnection() {
  return getReadOnlyConnection(getActiveCluster());
}

export function getDevnetConnection() {
  return getReadOnlyConnection("devnet");
}
