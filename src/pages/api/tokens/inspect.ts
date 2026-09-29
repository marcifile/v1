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
    const minimumLiquidityUsd =
      cluster === "mainnet"
        ? Math.max(0, Number(process.env.P0ND_MIN_POND_LIQUIDITY_USD || "10000"))
        : 0;
    const reasons: string[] = [];

    if (!inspected.launchSupportedNow) {
      reasons.push(
        inspected.tokenProgram === "token-2022"
          ? "Token-2022 quote mints require a Meteora token badge."
          : "This token program is not supported as a p0nd quote asset."
      );
    }
    if (cluster === "mainnet" && (!inspected.priceUsd || inspected.priceUsd <= 0)) {
      reasons.push("A reliable USD price is required.");
    }
    if (
      cluster === "mainnet" &&
      Number(inspected.market?.liquidityUsd || 0) < minimumLiquidityUsd
    ) {
      reasons.push(
        "Detected market liquidity must be at least $" +
          minimumLiquidityUsd.toLocaleString() +
          "."
      );
    }

    return res.status(200).json({
      ...inspected,
      eligibility: {
        eligible: reasons.length === 0,
        minimumLiquidityUsd,
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
