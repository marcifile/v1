import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { consumeRateLimit } from "@/lib/rateLimit";
import { extractSolanaAddress } from "@/lib/addressInput";
import { getActiveCluster, getServerConnection } from "@/lib/serverSolana";
import { derivePondConfigKeypair } from "@/lib/configSigner";
import { inspectToken } from "@/lib/tokenInspection";
import { ensureSchema, getDb } from "@/lib/db";
import { verifyConfirmedTransaction } from "@/lib/verifyTransaction";

type Body = {
  mint: string;
  payer: string;
  signature: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rate = consumeRateLimit(req, "pond-finalize-register", 30, 60 * 60 * 1000);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "Too many requests. Try again later." });
  }

  try {
    const body = req.body as Body;
    const cluster = getActiveCluster();
    const quoteMint = extractSolanaAddress(body.mint, "Pond mint");
    const payer = new PublicKey(String(body.payer || ""));
    const configSigner = derivePondConfigKeypair(quoteMint, cluster);

    const verified = await verifyConfirmedTransaction({
      signature: body.signature,
      expectedSigner: payer.toBase58(),
      expectedAccounts: [quoteMint.toBase58(), configSigner.publicKey.toBase58()],
    });

    const connection = getServerConnection();
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const state = await client.state.getPoolConfig(configSigner.publicKey);
    if (!state) throw new Error("Pond config is not confirmed on chain yet.");
    if (!state.quoteMint.equals(quoteMint)) {
      throw new Error("Confirmed config does not match the submitted pond mint.");
    }

    const inspected = await inspectToken(quoteMint, cluster);

    await ensureSchema();
    const result = await getDb().query(
      `
        INSERT INTO ponds
          (mint, symbol, name, config, quote_decimals, image_uri, price_usd, liquidity_usd, market_cap_usd, cluster)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (mint) DO UPDATE SET
          symbol = EXCLUDED.symbol,
          name = EXCLUDED.name,
          config = EXCLUDED.config,
          quote_decimals = EXCLUDED.quote_decimals,
          image_uri = EXCLUDED.image_uri,
          price_usd = EXCLUDED.price_usd,
          liquidity_usd = EXCLUDED.liquidity_usd,
          market_cap_usd = EXCLUDED.market_cap_usd,
          cluster = EXCLUDED.cluster,
          updated_at = NOW()
        RETURNING mint, symbol, name, config, quote_decimals
      `,
      [
        quoteMint.toBase58(),
        inspected.symbol || "TOKEN",
        inspected.name || inspected.symbol || "Pond",
        configSigner.publicKey.toBase58(),
        inspected.decimals,
        inspected.imageUri,
        inspected.priceUsd,
        inspected.market?.liquidityUsd || null,
        inspected.market?.marketCap || null,
        cluster,
      ]
    );

    await getDb().query(
      `
        INSERT INTO events (type, pond_mint, actor, tx_signature, metadata, cluster)
        VALUES ('pond_opened', $1, $2, $3, $4::jsonb, $5)
        ON CONFLICT DO NOTHING
      `,
      [
        quoteMint.toBase58(),
        payer.toBase58(),
        body.signature,
        JSON.stringify({
          config: configSigner.publicKey.toBase58(),
          verified: true,
          verifiedSlot: verified.slot,
        }),
        cluster,
      ]
    );

    return res.status(200).json({
      ok: true,
      pond: result.rows[0],
      inspection: inspected,
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Could not finalize pond registration.",
    });
  }
}
