import type { NextApiRequest, NextApiResponse } from "next";
import BN from "bn.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  CurveCalculator,
  FeeOn,
  getPdaObservationId,
  makeSwapCpmmBaseInInstruction,
} from "@raydium-io/raydium-sdk-v2";
import { consumeRateLimit } from "@/lib/rateLimit";
import { ensureSchema, getDb } from "@/lib/db";
import { getActiveCluster, getServerConnection } from "@/lib/serverSolana";
import { loadRaydium } from "@/lib/raydium";
import { baseUnitsToHuman, humanToBaseUnits } from "@/lib/units";

type Body = {
  baseMint: string;
  owner: string;
  direction: "buy" | "sell";
  amount: string;
  slippageBps?: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rate = consumeRateLimit(req, "raydium-swap", 120, 60 * 60 * 1000);
  if (!rate.ok) return res.status(429).json({ error: "Too many swap requests. Try again later." });

  try {
    if (getActiveCluster() !== "mainnet") {
      return res.status(400).json({ error: "Raydium fallback is mainnet only." });
    }

    const body = req.body as Body;
    const baseMint = new PublicKey(body.baseMint);
    const owner = new PublicKey(body.owner);

    await ensureSchema();
    const result = await getDb().query(
      `
        SELECT c.pool, c.pond_mint, p.quote_decimals, p.launch_engine
        FROM creatures c
        JOIN ponds p ON p.mint = c.pond_mint
        WHERE c.mint = $1 AND c.cluster = 'mainnet'
        LIMIT 1
      `,
      [baseMint.toBase58()]
    );

    const creature = result.rows[0];
    if (!creature || creature.launch_engine !== "raydium-cpmm") {
      return res.status(400).json({ error: "This creature does not use the Raydium route." });
    }

    const inputDecimals =
      body.direction === "buy" ? Number(creature.quote_decimals) : 6;
    const outputDecimals =
      body.direction === "buy" ? 6 : Number(creature.quote_decimals);
    const inputAmount = humanToBaseUnits(body.amount, inputDecimals);

    if (inputAmount.lte(new BN(0))) {
      return res.status(400).json({ error: "Swap amount must be greater than zero." });
    }

    const connection = getServerConnection();
    const raydium = await loadRaydium(owner);
    const poolId = String(creature.pool);
    const poolData = await raydium.cpmm.getPoolInfoFromRpc(poolId);
    const poolInfo = poolData.poolInfo as any;
    const poolKeys = poolData.poolKeys as any;
    const rpcData = poolData.rpcData as any;

    const inputMintAddress =
      body.direction === "buy"
        ? String(creature.pond_mint)
        : baseMint.toBase58();

    if (
      inputMintAddress !== poolInfo.mintA.address &&
      inputMintAddress !== poolInfo.mintB.address
    ) {
      throw new Error("Input mint does not match the creature pool.");
    }

    const baseIn = inputMintAddress === poolInfo.mintA.address;
    const inputMintInfo = baseIn ? poolInfo.mintA : poolInfo.mintB;
    const outputMintInfo = baseIn ? poolInfo.mintB : poolInfo.mintA;

    const inputMint = new PublicKey(inputMintInfo.address);
    const outputMint = new PublicKey(outputMintInfo.address);
    const inputTokenProgram = new PublicKey(
      inputMintInfo.programId || TOKEN_PROGRAM_ID
    );
    const outputTokenProgram = new PublicKey(
      outputMintInfo.programId || TOKEN_PROGRAM_ID
    );

    const inputAccounts = await connection.getParsedTokenAccountsByOwner(
      owner,
      { mint: inputMint },
      "confirmed"
    );

    let inputTokenAccount: PublicKey | null = null;
    let largestBalance = 0n;

    for (const entry of inputAccounts.value) {
      const info = (entry.account.data as any)?.parsed?.info;
      const raw = BigInt(String(info?.tokenAmount?.amount || "0"));
      if (raw > largestBalance) {
        largestBalance = raw;
        inputTokenAccount = entry.pubkey;
      }
      if (raw >= BigInt(inputAmount.toString(10))) {
        inputTokenAccount = entry.pubkey;
        largestBalance = raw;
        break;
      }
    }

    if (!inputTokenAccount || largestBalance < BigInt(inputAmount.toString(10))) {
      const held = baseUnitsToHuman(new BN(largestBalance.toString()), inputDecimals);
      return res.status(400).json({
        error:
          "you need " +
          body.amount +
          " " +
          (body.direction === "buy" ? "pond tokens" : "creature tokens") +
          " for this " +
          body.direction +
          "; this wallet has " +
          held +
          ".",
      });
    }

    const outputTokenAccount = getAssociatedTokenAddressSync(
      outputMint,
      owner,
      false,
      outputTokenProgram
    );

    const outputAccountInfo = await connection.getAccountInfo(
      outputTokenAccount,
      "confirmed"
    );

    const configInfo = rpcData.configInfo;
    if (!configInfo) throw new Error("Raydium pool fee config is unavailable.");

    const swapResult = CurveCalculator.swapBaseInput(
      inputAmount,
      baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
      baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
      configInfo.tradeFeeRate,
      configInfo.creatorFeeRate,
      configInfo.protocolFeeRate,
      configInfo.fundFeeRate,
      rpcData.feeOn === FeeOn.BothToken ||
        rpcData.feeOn === FeeOn.OnlyTokenB
    );

    const slippageBps = Math.min(
      Math.max(Number(body.slippageBps ?? 300), 1),
      2500
    );
    const minOutput = swapResult.outputAmount
      .mul(new BN(10_000 - slippageBps))
      .div(new BN(10_000));

    const tx = new Transaction();

    if (!outputAccountInfo) {
      tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
          owner,
          outputTokenAccount,
          owner,
          outputMint,
          outputTokenProgram
        )
      );
    }

    const inputVault = new PublicKey(poolKeys.vault[baseIn ? "A" : "B"]);
    const outputVault = new PublicKey(poolKeys.vault[baseIn ? "B" : "A"]);

    tx.add(
      makeSwapCpmmBaseInInstruction(
        new PublicKey(poolInfo.programId),
        owner,
        new PublicKey(poolKeys.authority),
        new PublicKey(poolKeys.config.id),
        new PublicKey(poolInfo.id),
        inputTokenAccount,
        outputTokenAccount,
        inputVault,
        outputVault,
        inputTokenProgram,
        outputTokenProgram,
        inputMint,
        outputMint,
        getPdaObservationId(
          new PublicKey(poolInfo.programId),
          new PublicKey(poolInfo.id)
        ).publicKey,
        inputAmount,
        minOutput
      )
    );

    const latest = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = owner;
    tx.recentBlockhash = latest.blockhash;

    return res.status(200).json({
      transaction: tx
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
      pool: poolId,
      direction: body.direction,
      amountIn: baseUnitsToHuman(inputAmount, inputDecimals),
      expectedAmountOut: baseUnitsToHuman(
        swapResult.outputAmount,
        outputDecimals
      ),
      minimumAmountOut: baseUnitsToHuman(minOutput, outputDecimals),
      engine: "raydium-cpmm",
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not build Raydium swap.",
    });
  }
}
