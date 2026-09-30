import type { NextApiRequest, NextApiResponse } from "next";
import BN from "bn.js";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  CREATE_CPMM_POOL_FEE_ACC,
  CREATE_CPMM_POOL_PROGRAM,
  TxVersion,
} from "@raydium-io/raydium-sdk-v2";
import { consumeRateLimit } from "@/lib/rateLimit";
import { ensureSchema, getDb } from "@/lib/db";
import { getActiveCluster, getServerConnection } from "@/lib/serverSolana";
import { humanToBaseUnits } from "@/lib/units";
import { loadRaydium } from "@/lib/raydium";

type Body = {
  baseMint: string;
  pondMint: string;
  payer: string;
  creatureLiquidity: string;
  quoteLiquidity: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rate = consumeRateLimit(req, "raydium-create-pool", 24, 60 * 60 * 1000);
  if (!rate.ok) return res.status(429).json({ error: "Too many pool creation attempts. Try again later." });

  try {
    if (getActiveCluster() !== "mainnet") {
      return res.status(400).json({ error: "Raydium fallback is mainnet only." });
    }

    const body = req.body as Body;
    const baseMint = new PublicKey(String(body.baseMint || ""));
    const pondMint = new PublicKey(String(body.pondMint || ""));
    const payer = new PublicKey(String(body.payer || ""));

    await ensureSchema();
    const pondResult = await getDb().query(
      `
        SELECT mint, symbol, quote_decimals, launch_engine
        FROM ponds
        WHERE mint = $1 AND cluster = 'mainnet'
        LIMIT 1
      `,
      [pondMint.toBase58()]
    );

    const pond = pondResult.rows[0];
    if (!pond) return res.status(404).json({ error: "Pond is not registered." });
    if (pond.launch_engine !== "raydium-cpmm") {
      return res.status(400).json({ error: "This pond uses the Meteora launch route." });
    }

    const connection = getServerConnection();
    const [baseAccount, quoteAccount] = await Promise.all([
      connection.getAccountInfo(baseMint, "confirmed"),
      connection.getAccountInfo(pondMint, "confirmed"),
    ]);

    if (!baseAccount?.owner.equals(TOKEN_PROGRAM_ID)) {
      return res.status(400).json({ error: "Creature mint is not ready yet." });
    }

    const quoteProgram = quoteAccount?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : quoteAccount?.owner.equals(TOKEN_PROGRAM_ID)
      ? TOKEN_PROGRAM_ID
      : null;

    if (!quoteProgram) {
      return res.status(400).json({ error: "Pond quote mint is not a supported token mint." });
    }

    const baseAmount = humanToBaseUnits(body.creatureLiquidity, 6);
    const quoteAmount = humanToBaseUnits(body.quoteLiquidity, Number(pond.quote_decimals));
    if (baseAmount.lte(new BN(0)) || quoteAmount.lte(new BN(0))) {
      return res.status(400).json({ error: "Initial liquidity amounts must be greater than zero." });
    }

    const walletQuoteAccounts = await connection.getParsedTokenAccountsByOwner(
      payer,
      { mint: pondMint },
      "confirmed"
    );

    let availableQuoteRaw = 0n;
    let availableQuoteUi = 0;
    for (const entry of walletQuoteAccounts.value) {
      const info = (entry.account.data as any)?.parsed?.info;
      const tokenAmount = info?.tokenAmount;
      if (!tokenAmount) continue;
      availableQuoteRaw += BigInt(String(tokenAmount.amount || "0"));
      availableQuoteUi += Number(
        tokenAmount.uiAmountString || tokenAmount.uiAmount || 0
      );
    }

    const availableQuote = new BN(availableQuoteRaw.toString());
    if (availableQuote.lt(quoteAmount)) {
      return res.status(400).json({
        error:
          "you need " +
          body.quoteLiquidity +
          " " +
          (pond.symbol || "pond tokens") +
          " for initial liquidity; this wallet has " +
          availableQuoteUi.toLocaleString(undefined, { maximumFractionDigits: 8 }) +
          ".",
      });
    }

    const raydium = await loadRaydium(payer);
    const feeConfigs = await raydium.api.getCpmmConfigs();
    if (!feeConfigs.length) throw new Error("Raydium CPMM fee config is unavailable.");

    const mintA = {
      address: baseMint.toBase58(),
      programId: TOKEN_PROGRAM_ID.toBase58(),
      decimals: 6,
    };
    const mintB = {
      address: pondMint.toBase58(),
      programId: quoteProgram.toBase58(),
      decimals: Number(pond.quote_decimals),
    };

    const built = await raydium.cpmm.createPool({
      programId: CREATE_CPMM_POOL_PROGRAM,
      poolFeeAccount: CREATE_CPMM_POOL_FEE_ACC,
      mintA,
      mintB,
      mintAAmount: baseAmount,
      mintBAmount: quoteAmount,
      startTime: new BN(0),
      feeConfig: feeConfigs[0],
      associatedOnly: false,
      addSupportMintExt: quoteProgram.equals(TOKEN_2022_PROGRAM_ID),
      ownerInfo: {
        useSOLBalance: false,
        feePayer: payer,
      },
      txVersion: TxVersion.LEGACY,
    });

    const transaction = built.transaction as Transaction;
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = payer;
    transaction.recentBlockhash = latest.blockhash;

    const address = (built.extInfo as any)?.address || {};
    const poolId =
      address.poolId?.toBase58?.() ||
      address.poolId?.toString?.() ||
      (built.extInfo as any)?.poolId?.toBase58?.() ||
      (built.extInfo as any)?.poolId?.toString?.();

    if (!poolId) {
      throw new Error("Raydium did not return the new pool address.");
    }

    return res.status(200).json({
      transaction: transaction
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
      pool: poolId,
      baseMint: baseMint.toBase58(),
      quoteMint: pondMint.toBase58(),
      creatureLiquidityBaseUnits: baseAmount.toString(10),
      quoteLiquidityBaseUnits: quoteAmount.toString(10),
      engine: "raydium-cpmm",
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not build Raydium pool.",
    });
  }
}
