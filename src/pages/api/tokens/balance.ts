import type { NextApiRequest, NextApiResponse } from "next";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getServerConnection } from "@/lib/serverSolana";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const owner = new PublicKey(String(req.query.owner || ""));
    const mint = new PublicKey(String(req.query.mint || ""));
    const connection = getServerConnection();

    if (mint.equals(NATIVE_MINT)) {
      const lamports = await connection.getBalance(owner, "confirmed");
      return res.status(200).json({
        amount: lamports / LAMPORTS_PER_SOL,
        amountBaseUnits: String(lamports),
        decimals: 9,
      });
    }

    const mintAccount = await connection.getAccountInfo(mint, "confirmed");
    const tokenProgram = mintAccount?.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : mintAccount?.owner.equals(TOKEN_PROGRAM_ID)
      ? TOKEN_PROGRAM_ID
      : null;

    if (!tokenProgram) {
      return res.status(400).json({ error: "Pond token mint is not a supported Solana token." });
    }

    const ata = getAssociatedTokenAddressSync(mint, owner, false, tokenProgram);
    const ataInfo = await connection.getAccountInfo(ata, "confirmed");
    if (!ataInfo) {
      return res.status(200).json({
        amount: 0,
        amountBaseUnits: "0",
        decimals: 0,
      });
    }

    const tokenAmount = await connection.getTokenAccountBalance(ata, "confirmed");
    return res.status(200).json({
      amount: Number(tokenAmount.value.uiAmountString || tokenAmount.value.uiAmount || 0),
      amountBaseUnits: tokenAmount.value.amount,
      decimals: tokenAmount.value.decimals,
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Could not read wallet balance.",
    });
  }
}
