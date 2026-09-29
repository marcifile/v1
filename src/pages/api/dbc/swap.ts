import type { NextApiRequest, NextApiResponse } from "next";
import BN from "bn.js";
import { PublicKey } from "@solana/web3.js";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  ActivationType,
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { baseUnitsToHuman, humanToBaseUnits } from "@/lib/units";
import { getServerConnection } from "@/lib/serverSolana";

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

  try {
    const body = req.body as Body;
    const baseMint = new PublicKey(body.baseMint);
    const owner = new PublicKey(body.owner);
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

    const slot = await connection.getSlot("confirmed");
    const currentPoint =
      Number(config.activationType) === ActivationType.Timestamp
        ? new BN(
            String(
              (await connection.getBlockTime(slot)) ||
                Math.floor(Date.now() / 1000)
            )
          )
        : new BN(String(slot));

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
      payer: owner,
      pool: pool.publicKey,
      amountIn,
      minimumAmountOut: quote.minimumAmountOut,
      swapBaseForQuote,
      referralTokenAccount: null,
    });

    const latest = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = owner;
    tx.recentBlockhash = latest.blockhash;

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
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to build swap.",
    });
  }
}
