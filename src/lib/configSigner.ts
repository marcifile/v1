import crypto from "crypto";
import { Keypair, PublicKey } from "@solana/web3.js";
import type { P0ndCluster } from "@/lib/serverSolana";

function masterSeed() {
  const encoded = process.env.P0ND_CONFIG_SEED_B64;
  if (!encoded) throw new Error("P0ND_CONFIG_SEED_B64 is not configured.");
  const seed = Buffer.from(encoded, "base64");
  if (seed.length < 32) throw new Error("P0ND_CONFIG_SEED_B64 is invalid.");
  return seed;
}

export function derivePondConfigKeypair(
  quoteMint: PublicKey,
  cluster: P0ndCluster
) {
  const digest = crypto
    .createHmac("sha256", masterSeed())
    .update("p0nd-config-v1:" + cluster + ":" + quoteMint.toBase58())
    .digest();
  return Keypair.fromSeed(Uint8Array.from(digest.subarray(0, 32)));
}
