import type { NextApiRequest, NextApiResponse } from "next";
import { Transaction } from "@solana/web3.js";
import { consumeRateLimit } from "@/lib/rateLimit";
import { getServerConnection } from "@/lib/serverSolana";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rate = consumeRateLimit(req, "solana-send-transaction", 90, 60 * 60 * 1000);
  if (!rate.ok) return res.status(429).json({ error: "Too many transaction attempts. Try again later." });

  try {
    const encoded = String(req.body?.transaction || "").trim();
    if (!encoded) return res.status(400).json({ error: "Signed transaction is required." });

    const raw = Buffer.from(encoded, "base64");
    // Parse before forwarding so malformed payloads never reach the RPC.
    Transaction.from(raw);

    const connection = getServerConnection();
    const signature = await connection.sendRawTransaction(raw, {
      skipPreflight: false,
      maxRetries: 3,
    });
    const confirmation = await connection.confirmTransaction(signature, "confirmed");
    if (confirmation.value.err) {
      return res.status(400).json({
        error: "Transaction failed: " + JSON.stringify(confirmation.value.err),
        signature,
      });
    }

    return res.status(200).json({ signature });
  } catch (error: any) {
    const message =
      error?.message ||
      error?.data?.message ||
      "Could not submit transaction.";
    return res.status(400).json({ error: message });
  }
}
