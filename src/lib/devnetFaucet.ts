import { createHash } from "crypto";
import { Keypair } from "@solana/web3.js";

function rootSeed(): Buffer {
  const encoded = process.env.DEVNET_FAUCET_SEED_B64;
  if (!encoded) {
    throw new Error("DEVNET_FAUCET_SEED_B64 is not configured.");
  }
  const seed = Buffer.from(encoded, "base64");
  if (seed.length !== 32) {
    throw new Error("DEVNET_FAUCET_SEED_B64 must decode to 32 bytes.");
  }
  return seed;
}

export function devnetFaucetKeypair() {
  return Keypair.fromSeed(rootSeed());
}

export function deriveDevnetKeypair(label: string) {
  const seed = createHash("sha256")
    .update(rootSeed())
    .update(label)
    .digest()
    .subarray(0, 32);
  return Keypair.fromSeed(seed);
}
