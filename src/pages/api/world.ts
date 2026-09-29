import type { NextApiRequest, NextApiResponse } from "next";
import { ensureSchema, getDb } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await ensureSchema();
    const db = getDb();

    const [pondResult, creatureResult, eventResult] = await Promise.all([
      db.query(`
        SELECT
          p.mint, p.symbol, p.name, p.config, p.quote_decimals,
          COUNT(c.mint)::int AS creature_count,
          COALESCE(SUM(latest.quote_reserve), 0)::text AS quote_reserve_base_units,
          COALESCE(SUM(latest.total_trading_quote_fee), 0)::text AS total_trading_quote_fee_base_units
        FROM ponds p
        LEFT JOIN creatures c ON c.pond_mint = p.mint
        LEFT JOIN LATERAL (
          SELECT s.quote_reserve, s.total_trading_quote_fee
          FROM snapshots s
          WHERE s.creature_mint = c.mint
          ORDER BY s.recorded_at DESC
          LIMIT 1
        ) latest ON TRUE
        GROUP BY p.mint
        ORDER BY p.created_at ASC
      `),
      db.query(`
        SELECT
          c.mint, c.pond_mint, c.pool, c.config, c.creator,
          c.name, c.symbol, c.metadata_uri, c.image_uri, c.description,
          c.website_url, c.x_url, c.telegram_url, c.launch_tx, c.status, c.created_at,
          p.symbol AS pond_symbol,
          p.name AS pond_name,
          p.quote_decimals,
          COALESCE(latest.quote_reserve, 0)::text AS quote_reserve_base_units,
          COALESCE(latest.migration_threshold, 0)::text AS migration_threshold_base_units,
          COALESCE(latest.progress, 0)::float8 AS progress,
          COALESCE(latest.migrated, false) AS migrated,
          COALESCE(latest.creator_quote_fee, 0)::text AS creator_quote_fee_base_units,
          COALESCE(latest.total_trading_quote_fee, 0)::text AS total_trading_quote_fee_base_units,
          latest.recorded_at AS snapshot_at
        FROM creatures c
        JOIN ponds p ON p.mint = c.pond_mint
        LEFT JOIN LATERAL (
          SELECT s.*
          FROM snapshots s
          WHERE s.creature_mint = c.mint
          ORDER BY s.recorded_at DESC
          LIMIT 1
        ) latest ON TRUE
        ORDER BY c.created_at DESC
      `),
      db.query(`
        SELECT id, type, creature_mint, pond_mint, actor, tx_signature,
               amount_in, amount_out, metadata, created_at
        FROM events
        ORDER BY created_at DESC
        LIMIT 30
      `),
    ]);

    return res.status(200).json({
      ponds: pondResult.rows,
      creatures: creatureResult.rows,
      events: eventResult.rows,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not load POND world.",
    });
  }
}
