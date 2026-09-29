import type { NextApiRequest, NextApiResponse } from "next";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { getActiveCluster, getServerConnection } from "@/lib/serverSolana";
import { consumeRateLimit } from "@/lib/rateLimit";

const CREATURE_DECIMALS = 6;
const CREATURE_SUPPLY = 1_000_000_000n * 10n ** BigInt(CREATURE_DECIMALS);

type Body = {
  baseMint: string;
  payer: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rate = consumeRateLimit(req, "raydium-create-mint", 30, 60 * 60 * 1000);
  if (!rate.ok) return res.status(429).json({ error: "Too many launch attempts. Try again later." });

  try {
    if (getActiveCluster() !== "mainnet") {
      return res.status(400).json({ error: "Raydium fallback is mainnet only." });
    }

    const baseMint = new PublicKey(String((req.body as Body)?.baseMint || ""));
    const payer = new PublicKey(String((req.body as Body)?.payer || ""));
    const connection = getServerConnection();

    const existing = await connection.getAccountInfo(baseMint, "confirmed");
    if (existing) return res.status(409).json({ error: "Creature mint already exists." });

    const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const ata = getAssociatedTokenAddressSync(baseMint, payer);

    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: baseMint,
        lamports: rent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        baseMint,
        CREATURE_DECIMALS,
        payer,
        null,
        TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        payer,
        ata,
        payer,
        baseMint,
        TOKEN_PROGRAM_ID
      ),
      createMintToInstruction(
        baseMint,
        ata,
        payer,
        CREATURE_SUPPLY,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const latest = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = payer;
    tx.recentBlockhash = latest.blockhash;

    return res.status(200).json({
      transaction: tx
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
      baseMint: baseMint.toBase58(),
      ownerAta: ata.toBase58(),
      decimals: CREATURE_DECIMALS,
      supplyBaseUnits: CREATURE_SUPPLY.toString(),
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Could not build creature mint.",
    });
  }
}
