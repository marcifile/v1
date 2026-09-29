import { Connection, PublicKey } from "@solana/web3.js";

const FALLBACK_DEVNET_RPC = "https://api.devnet.solana.com";
const FALLBACK_MAINNET_RPC = "https://api.mainnet-beta.solana.com";

export const POND_PROJECT_WALLET = new PublicKey(
  process.env.POND_PROJECT_WALLET ||
    "o1JFNnUtjJaapQrBYszwpoQhkiwn9DkfpQ6UAQztXbv"
);

export function assertDevnet() {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
  if (cluster !== "devnet") {
    throw new Error("POND v1 transaction APIs are locked to devnet.");
  }
}

export function getRpcUrl(cluster: "devnet" | "mainnet") {
  if (cluster === "mainnet") {
    return process.env.MAINNET_RPC_URL || FALLBACK_MAINNET_RPC;
  }
  return process.env.DEVNET_RPC_URL || FALLBACK_DEVNET_RPC;
}

export function getReadOnlyConnection(cluster: "devnet" | "mainnet") {
  return new Connection(getRpcUrl(cluster), "confirmed");
}

export function getServerConnection() {
  assertDevnet();
  return getReadOnlyConnection("devnet");
}
