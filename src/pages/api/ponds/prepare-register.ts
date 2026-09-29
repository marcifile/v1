import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import {
  deriveTokenBadgeAddress,
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { consumeRateLimit } from "@/lib/rateLimit";
import { extractSolanaAddress } from "@/lib/addressInput";
import {
  getActiveCluster,
  getServerConnection,
  POND_PROJECT_WALLET,
} from "@/lib/serverSolana";
import { inspectToken } from "@/lib/tokenInspection";
import { derivePondConfigKeypair } from "@/lib/configSigner";
import { buildPondCurve, buildDevnetPondCurve } from "@/lib/dbcPreset";
import { ensureSchema, getDb } from "@/lib/db";

type Body = {
  mint: string;
  payer: string;
};

function migrationTargetUsd() {
  const value = Number(process.env.P0ND_MIGRATION_TARGET_USD || "25000");
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("P0ND_MIGRATION_TARGET_USD is invalid.");
  }
  return value;
}

function minPondLiquidityUsd() {
  const value = Number(process.env.P0ND_MIN_POND_LIQUIDITY_USD || "0");
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const rate = consumeRateLimit(req, "pond-prepare-register", 24, 60 * 60 * 1000);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "Too many pond registration attempts. Try again later." });
  }

  try {
    const cluster = getActiveCluster();
    const quoteMint = extractSolanaAddress(req.body?.mint, "Pond mint");
    const payer = new PublicKey(String((req.body as Body)?.payer || ""));
    const inspected = await inspectToken(quoteMint, cluster);

    if (!inspected.launchSupportedNow) {
      return res.status(400).json({
        error:
          inspected.tokenProgram === "token-2022"
            ? "This Token-2022 mint does not have the Meteora quote-token badge required to open it as a pond."
            : "This token is not currently compatible with p0nd pond creation.",
        inspection: inspected,
      });
    }

    if (cluster === "mainnet") {
      if (!inspected.priceUsd || inspected.priceUsd <= 0) {
        return res.status(400).json({
          error: "A reliable USD price is required before this token can become a pond.",
          inspection: inspected,
        });
      }
      const liquidity = Number(inspected.market?.liquidityUsd || 0);
      const minimum = minPondLiquidityUsd();
      if (liquidity < minimum) {
        return res.status(400).json({
          error:
            "This token does not meet the current pond liquidity floor of $" +
            minimum.toLocaleString() +
            ".",
          inspection: inspected,
        });
      }
    }

    await ensureSchema();
    const db = getDb();
    const existing = await db.query(
      "SELECT mint, symbol, name, config, quote_decimals FROM ponds WHERE mint = $1 AND cluster = $2",
      [quoteMint.toBase58(), cluster]
    );
    if (existing.rowCount) {
      return res.status(200).json({
        alreadyRegistered: true,
        pond: existing.rows[0],
        inspection: inspected,
      });
    }

    const connection = getServerConnection();
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const configSigner = derivePondConfigKeypair(quoteMint, cluster);
    const configState = await client.state.getPoolConfig(configSigner.publicKey);

    const targetUsd = cluster === "mainnet" ? migrationTargetUsd() : null;
    const thresholdTokens =
      cluster === "mainnet"
        ? targetUsd! / Number(inspected.priceUsd)
        : 1000;

    if (configState) {
      if (!configState.quoteMint.equals(quoteMint)) {
        throw new Error("Derived pond config belongs to a different quote mint.");
      }

      const result = await db.query(
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

      return res.status(200).json({
        alreadyRegistered: true,
        recoveredOnChainConfig: true,
        pond: result.rows[0],
        inspection: inspected,
      });
    }

    const tokenBadge = inspected.tokenBadgeExists
      ? deriveTokenBadgeAddress(quoteMint)
      : undefined;

    const curve =
      cluster === "devnet"
        ? buildDevnetPondCurve(inspected.decimals)
        : buildPondCurve({
            quoteDecimals: inspected.decimals,
            migrationQuoteThreshold: thresholdTokens,
          });

    const tx = await client.partner.createConfig({
      config: configSigner.publicKey,
      feeClaimer: POND_PROJECT_WALLET,
      leftoverReceiver: POND_PROJECT_WALLET,
      payer,
      quoteMint,
      tokenBadge,
      ...curve,
    });

    const latest = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = payer;
    tx.recentBlockhash = latest.blockhash;
    tx.partialSign(configSigner);

    return res.status(200).json({
      alreadyRegistered: false,
      transaction: tx
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
      quoteMint: quoteMint.toBase58(),
      config: configSigner.publicKey.toBase58(),
      cluster,
      inspection: inspected,
      economics: {
        migrationTargetUsd: targetUsd,
        migrationQuoteThreshold: thresholdTokens,
        tradingFeeBps: 100,
        creatorFeeSharePercent: 50,
      },
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Could not prepare pond registration.",
    });
  }
}
