import type { NextApiRequest, NextApiResponse } from "next";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
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

    const [legacy, token2022] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }, "confirmed"),
      connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }, "confirmed"),
    ]);

    let amount = 0;
    let amountBaseUnits = 0n;
    let decimals = 0;

    for (const entry of [...legacy.value, ...token2022.value]) {
      const info = (entry.account.data as any)?.parsed?.info;
      if (info?.mint !== mint.toBase58()) continue;
      const tokenAmount = info?.tokenAmount;
      if (!tokenAmount) continue;
      amount += Number(tokenAmount.uiAmountString || tokenAmount.uiAmount || 0);
      amountBaseUnits += BigInt(String(tokenAmount.amount || "0"));
      decimals = Number(tokenAmount.decimals || 0);
    }

    return res.status(200).json({
      amount,
      amountBaseUnits: amountBaseUnits.toString(),
      decimals,
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Could not read wallet balance.",
    });
  }
}
