import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { baseUnitsToHuman } from "@/lib/units";
import { getServerConnection } from "@/lib/serverSolana";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const baseMint = new PublicKey(String(req.query.baseMint || ""));
    const connection = getServerConnection();
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const pool = await client.state.getPoolByBaseMint(baseMint);

    if (!pool) {
      return res.status(404).json({ error: "Creature pool not found." });
    }

    const state = pool.account.poolState;
    const config = await client.state.getPoolConfig(state.config);
    if (!config) {
      return res.status(404).json({ error: "Pond config not found." });
    }

    const quoteMint = config.quoteMint;
    const quoteInfo = await connection.getAccountInfo(quoteMint, "confirmed");

    if (!quoteInfo || !quoteInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      return res.status(400).json({ error: "Unsupported quote token program." });
    }

    const quoteMintState = await getMint(
      connection,
      quoteMint,
      "confirmed",
      TOKEN_PROGRAM_ID
    );

    const [progress, feeMetrics] = await Promise.all([
      client.state.getPoolQuoteTokenCurveProgress(pool.publicKey),
      client.state.getPoolFeeMetrics(pool.publicKey),
    ]);

    return res.status(200).json({
      pool: pool.publicKey.toBase58(),
      baseMint: state.baseMint.toBase58(),
      quoteMint: quoteMint.toBase58(),
      config: state.config.toBase58(),
      quoteDecimals: quoteMintState.decimals,
      quoteReserveBaseUnits: state.quoteReserve.toString(10),
      quoteReserve: baseUnitsToHuman(state.quoteReserve, quoteMintState.decimals),
      migrationQuoteThresholdBaseUnits:
        config.migrationQuoteThreshold.toString(10),
      migrationQuoteThreshold: baseUnitsToHuman(
        config.migrationQuoteThreshold,
        quoteMintState.decimals
      ),
      progress,
      progressPercent: Math.round(progress * 10000) / 100,
      isMigrated: Number(state.isMigrated) !== 0,
      creatorQuoteFeeBaseUnits: feeMetrics.current.creatorQuoteFee.toString(10),
      creatorQuoteFee: baseUnitsToHuman(
        feeMetrics.current.creatorQuoteFee,
        quoteMintState.decimals
      ),
      totalTradingQuoteFeeBaseUnits:
        feeMetrics.total.totalTradingQuoteFee.toString(10),
      totalTradingQuoteFee: baseUnitsToHuman(
        feeMetrics.total.totalTradingQuoteFee,
        quoteMintState.decimals
      ),
      creatorTradingFeePercentage: config.creatorTradingFeePercentage,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to read pond status.",
    });
  }
}
