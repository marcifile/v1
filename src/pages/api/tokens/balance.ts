import type { NextApiRequest, NextApiResponse } from "next";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
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
        accounts: 1,
      });
    }

    // Query by the exact mint instead of assuming the balance is stored in the
    // canonical associated token account. A wallet can legitimately own the
    // same mint in multiple token accounts, including Token-2022 accounts.
    // The mint filter keeps this lookup narrow even for wallets with many assets.
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      owner,
      { mint },
      "confirmed"
    );

    let rawTotal = 0n;
    let decimals = 0;
    let uiTotal = 0;

    for (const entry of tokenAccounts.value) {
      const info = (entry.account.data as any)?.parsed?.info;
      const tokenAmount = info?.tokenAmount;
      if (!tokenAmount) continue;

      rawTotal += BigInt(String(tokenAmount.amount || "0"));
      decimals = Number(tokenAmount.decimals || decimals || 0);
      uiTotal += Number(
        tokenAmount.uiAmountString || tokenAmount.uiAmount || 0
      );
    }

    return res.status(200).json({
      amount: uiTotal,
      amountBaseUnits: rawTotal.toString(),
      decimals,
      accounts: tokenAccounts.value.length,
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Could not read wallet balance.",
    });
  }
}
