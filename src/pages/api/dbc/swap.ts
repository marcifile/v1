import type { NextApiRequest, NextApiResponse } from "next";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  ActivationType,
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { baseUnitsToHuman, humanToBaseUnits } from "@/lib/units";
import { devnetFaucetKeypair } from "@/lib/devnetFaucet";
import { getActiveCluster, getServerConnection } from "@/lib/serverSolana";
import { ensureSchema, getDb } from "@/lib/db";
import { consumeRateLimit } from "@/lib/rateLimit";

type Body = {
  baseMint: string;
  owner: string;
  direction: "buy" | "sell";
  amount: string;
  slippageBps?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rate = consumeRateLimit(req, "swap", 120, 3600000);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: "Too many requests. Try again later.",
    });
  }

  try {
    const body = req.body as Body;
    const baseMint = new PublicKey(body.baseMint);
    const owner = new PublicKey(body.owner);
    const cluster = getActiveCluster();
    await ensureSchema();
    const registered = await getDb().query(
      "SELECT mint FROM creatures WHERE mint = $1 AND cluster = $2",
      [baseMint.toBase58(), cluster]
    );
    if (registered.rowCount === 0) {
      return res.status(403).json({
        error: "That token is not a registered p0nd creature.",
      });
    }

    const sponsor = cluster === "devnet" ? devnetFaucetKeypair() : null;
    const connection = getServerConnection();
    const client = new DynamicBondingCurveClient(connection, "confirmed");

    const pool = await client.state.getPoolByBaseMint(baseMint);
    if (!pool) {
      return res.status(404).json({ error: "Creature pool not found." });
    }

    const virtualPool = pool.account;
    const poolState = virtualPool.poolState;
    const config = await client.state.getPoolConfig(poolState.config);
    if (!config) {
      return res.status(404).json({ error: "Pond config not found." });
    }

    const baseMintInfo = await getMint(
      connection,
      poolState.baseMint,
      "confirmed",
      TOKEN_PROGRAM_ID
    );
    const quoteMintInfo = await getMint(
      connection,
      config.quoteMint,
      "confirmed",
      TOKEN_PROGRAM_ID
    );

    const swapBaseForQuote = body.direction === "sell";
    const inputDecimals = swapBaseForQuote
      ? baseMintInfo.decimals
      : quoteMintInfo.decimals;
    const outputDecimals = swapBaseForQuote
      ? quoteMintInfo.decimals
      : baseMintInfo.decimals;

    const amountIn = humanToBaseUnits(body.amount, inputDecimals);
    if (amountIn.lte(new BN(0))) {
      return res.status(400).json({ error: "Swap amount must be greater than zero." });
    }

    const currentPoint =
      Number(config.activationType) === ActivationType.Timestamp
        ? new BN(String(Math.floor(Date.now() / 1000)))
        : new BN(String(await connection.getSlot("confirmed")));

    const slippageBps = Math.min(
      Math.max(Number(body.slippageBps ?? 200), 1),
      2500
    );

    const quote = await client.pool.swapQuote({
      virtualPool,
      config,
      swapBaseForQuote,
      amountIn,
      slippageBps,
      hasReferral: false,
      eligibleForFirstSwapWithMinFee: false,
      currentPoint,
    });

    const tx = await client.pool.swap({
      owner,
      payer: sponsor?.publicKey || owner,
      pool: pool.publicKey,
      amountIn,
      minimumAmountOut: quote.minimumAmountOut,
      swapBaseForQuote,
      referralTokenAccount: null,
    });

    const latest = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = sponsor?.publicKey || owner;
    tx.recentBlockhash = latest.blockhash;
    if (sponsor) tx.partialSign(sponsor);

    return res.status(200).json({
      transaction: tx
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
      pool: pool.publicKey.toBase58(),
      direction: body.direction,
      amountIn: baseUnitsToHuman(amountIn, inputDecimals),
      expectedAmountOut: baseUnitsToHuman(quote.outputAmount, outputDecimals),
      minimumAmountOut: baseUnitsToHuman(
        quote.minimumAmountOut,
        outputDecimals
      ),
      tradingFeeBaseUnits: quote.tradingFee.toString(10),
      sponsored: Boolean(sponsor),
      cluster,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to build swap.",
    });
  }
}
