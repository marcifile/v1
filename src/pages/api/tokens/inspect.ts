import type { NextApiRequest, NextApiResponse } from "next";
import { consumeRateLimit } from "@/lib/rateLimit";
import { extractSolanaAddress } from "@/lib/addressInput";
import { getActiveCluster, type P0ndCluster } from "@/lib/serverSolana";
import { inspectToken } from "@/lib/tokenInspection";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rate = consumeRateLimit(req, "token-inspect", 90, 60 * 60 * 1000);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "Too many token inspections. Try again later." });
  }

  try {
    const mint = extractSolanaAddress(req.query.mint, "Token mint");
    const requested = String(req.query.cluster || "").toLowerCase();
    const cluster: P0ndCluster =
      requested === "mainnet" || requested === "mainnet-beta"
        ? "mainnet"
        : requested === "devnet"
        ? "devnet"
        : getActiveCluster();

    return res.status(200).json(await inspectToken(mint, cluster));
  } catch (error) {
    return res.status(400).json({
      error:
        error instanceof Error ? error.message : "Could not inspect token.",
    });
  }
}
