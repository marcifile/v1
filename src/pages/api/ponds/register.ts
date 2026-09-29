import type { NextApiRequest, NextApiResponse } from "next";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  deriveTokenBadgeAddress,
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { deriveDevnetKeypair } from "@/lib/devnetFaucet";
import { ensureDevnetSponsor, parsePublicKey } from "@/lib/devnetSponsor";
import { buildDevnetPondCurve } from "@/lib/dbcPreset";
import { ensureSchema, getDb } from "@/lib/db";
import { POND_PROJECT_WALLET } from "@/lib/serverSolana";
import { consumeRateLimit } from "@/lib/rateLimit";

type Body = {
  mint: string;
  symbol?: string;
  name?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rate = consumeRateLimit(req, "pond-register", 12, 3600000);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: "Too many requests. Try again later.",
    });
  }

  try {
    const quoteMint = parsePublicKey(req.body?.mint, "Pond mint");
    const labelSymbol = String(req.body?.symbol || "QUOTE")
      .trim()
      .toUpperCase()
      .slice(0, 10);
    const labelName = String(req.body?.name || "Pond")
      .trim()
      .slice(0, 40);

    await ensureSchema();
    const db = getDb();

    const existing = await db.query(
      "SELECT mint, symbol, name, config, quote_decimals FROM ponds WHERE mint = $1",
      [quoteMint.toBase58()]
    );
    if (existing.rowCount) {
      return res.status(200).json({
        created: false,
        pond: existing.rows[0],
      });
    }

    const { connection, sponsor } = await ensureDevnetSponsor();
    const account = await connection.getAccountInfo(quoteMint, "confirmed");
    if (!account) {
      return res.status(400).json({ error: "That token does not exist on devnet." });
    }
    if (!account.owner.equals(TOKEN_PROGRAM_ID)) {
      return res.status(400).json({
        error: "POND devnet currently accepts standard SPL quote tokens only.",
      });
    }

    const mint = await getMint(connection, quoteMint, "confirmed", TOKEN_PROGRAM_ID);
    const config = deriveDevnetKeypair(
      "pond-config-v2:" + quoteMint.toBase58()
    );
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const [configState, tokenBadgeState] = await Promise.all([
      client.state.getPoolConfig(config.publicKey),
      client.state.getTokenBadge(quoteMint).catch(() => null),
    ]);
    const tokenBadge = tokenBadgeState
      ? deriveTokenBadgeAddress(quoteMint)
      : undefined;

    if (!configState) {
      const tx = await client.partner.createConfig({
        config: config.publicKey,
        feeClaimer: POND_PROJECT_WALLET,
        leftoverReceiver: POND_PROJECT_WALLET,
        payer: sponsor.publicKey,
        quoteMint,
        tokenBadge,
        ...buildDevnetPondCurve(mint.decimals),
      });
      const latest = await connection.getLatestBlockhash("confirmed");
      tx.feePayer = sponsor.publicKey;
      tx.recentBlockhash = latest.blockhash;
      tx.partialSign(sponsor, config);
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      await connection.confirmTransaction(signature, "confirmed");
    }

    const result = await db.query(
      `
        INSERT INTO ponds (mint, symbol, name, config, quote_decimals)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (mint) DO UPDATE SET
          symbol = EXCLUDED.symbol,
          name = EXCLUDED.name,
          config = EXCLUDED.config,
          quote_decimals = EXCLUDED.quote_decimals,
          updated_at = NOW()
        RETURNING mint, symbol, name, config, quote_decimals
      `,
      [
        quoteMint.toBase58(),
        labelSymbol || "QUOTE",
        labelName || "Pond",
        config.publicKey.toBase58(),
        mint.decimals,
      ]
    );

    return res.status(200).json({
      created: true,
      pond: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not register pond.",
    });
  }
}
