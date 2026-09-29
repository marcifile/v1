import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { baseUnitsToHuman } from "@/lib/units";
import { devnetFaucetKeypair } from "@/lib/devnetFaucet";
import { getServerConnection } from "@/lib/serverSolana";
import { consumeRateLimit } from "@/lib/rateLimit";

type Body = {
  baseMint: string;
  creator: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rate = consumeRateLimit(req, "claim-fee", 30, 3600000);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: "Too many requests. Try again later.",
    });
  }

  try {
    const body = req.body as Body;
    const baseMint = new PublicKey(String(body.baseMint || ""));
    const creator = new PublicKey(String(body.creator || ""));
    const sponsor = devnetFaucetKeypair();
    const connection = getServerConnection();
    const client = new DynamicBondingCurveClient(connection, "confirmed");

    const pool = await client.state.getPoolByBaseMint(baseMint);
    if (!pool) {
      return res.status(404).json({ error: "Creature pool not found." });
    }

    if (!pool.account.poolState.creator.equals(creator)) {
      return res.status(403).json({
        error: "Only this creature's on-chain creator can claim its creator fees.",
      });
    }

    const config = await client.state.getPoolConfig(
      pool.account.poolState.config
    );
    if (!config) {
      return res.status(404).json({ error: "Pond config not found." });
    }

    const quoteInfo = await connection.getAccountInfo(
      config.quoteMint,
      "confirmed"
    );
    if (!quoteInfo || !quoteInfo.owner.equals(TOKEN_PROGRAM_ID)) {
      return res.status(400).json({
        error: "Unsupported quote token program.",
      });
    }

    const quoteMintState = await getMint(
      connection,
      config.quoteMint,
      "confirmed",
      TOKEN_PROGRAM_ID
    );

    const feeMetrics = await client.state.getPoolFeeMetrics(pool.publicKey);
    const creatorQuoteFee = feeMetrics.current.creatorQuoteFee;
    const creatorBaseFee = feeMetrics.current.creatorBaseFee;

    if (creatorQuoteFee.isZero() && creatorBaseFee.isZero()) {
      return res.status(400).json({
        error: "No creator trading fees are claimable yet.",
      });
    }

    const tx = await client.creator.claimCreatorTradingFee2({
      creator,
      payer: sponsor.publicKey,
      pool: pool.publicKey,
      maxBaseAmount: creatorBaseFee,
      maxQuoteAmount: creatorQuoteFee,
      receiver: creator,
    });

    const latest = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = sponsor.publicKey;
    tx.recentBlockhash = latest.blockhash;
    tx.partialSign(sponsor);

    return res.status(200).json({
      transaction: tx
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
      pool: pool.publicKey.toBase58(),
      quoteMint: config.quoteMint.toBase58(),
      claimQuoteBaseUnits: creatorQuoteFee.toString(10),
      claimQuote: baseUnitsToHuman(
        creatorQuoteFee,
        quoteMintState.decimals
      ),
      creatorTradingFeePercentage: config.creatorTradingFeePercentage,
      sponsored: true,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Could not build creator fee claim.",
    });
  }
}
