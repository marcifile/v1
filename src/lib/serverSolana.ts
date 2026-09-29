import { Connection, PublicKey } from "@solana/web3.js";

const FALLBACK_DEVNET_RPC = "https://api.devnet.solana.com";

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

export function getServerConnection() {
  assertDevnet();
  return new Connection(
    process.env.DEVNET_RPC_URL || FALLBACK_DEVNET_RPC,
    "confirmed"
  );
}
