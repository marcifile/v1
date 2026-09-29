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

    const inspected = await inspectToken(mint, cluster);
    const reasons: string[] = [];

    // P0ND should not invent market/liquidity requirements for becoming a pond.
    // The real compatibility boundary is whether Meteora can use the mint as a
    // quote asset. Standard SPL mints work directly; some Token-2022 mints need
    // a Meteora token badge.
    if (!inspected.launchSupportedNow) {
      reasons.push(
        inspected.tokenProgram === "token-2022"
          ? "This Token-2022 quote mint needs a Meteora token badge before it can be used as a pond."
          : "This token program is not supported as a p0nd quote asset."
      );
    }

    return res.status(200).json({
      ...inspected,
      eligibility: {
        eligible: reasons.length === 0,
        minimumLiquidityUsd: 0,
        reasons,
      },
    });
  } catch (error) {
    return res.status(400).json({
      error:
        error instanceof Error ? error.message : "Could not inspect token.",
    });
  }
}
