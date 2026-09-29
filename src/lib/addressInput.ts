import { PublicKey } from "@solana/web3.js";

const BASE58_CANDIDATE = /[1-9A-HJ-NP-Za-km-z]{32,44}/g;

export const NATIVE_SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);

const SOL_ALIASES = new Set(["sol", "solana", "native sol", "native-sol", "wsol"]);

export function extractSolanaAddress(input: unknown, label = "Solana address") {
  const raw = String(input || "").trim();
  if (!raw) throw new Error(label + " is required.");

  if (SOL_ALIASES.has(raw.toLowerCase())) {
    return NATIVE_SOL_MINT;
  }

  const candidates = [raw, ...(raw.match(BASE58_CANDIDATE) || [])];

  for (const candidate of candidates) {
    try {
      return new PublicKey(candidate);
    } catch {
      // Try the next base58-looking segment.
    }
  }

  throw new Error(
    label +
      " was not found. Paste a token mint or a link that contains the mint."
  );
}
