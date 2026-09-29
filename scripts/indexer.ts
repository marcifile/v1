import { ensureSchema, getDb } from "../src/lib/db";
import { readCreatureSnapshot } from "../src/lib/chainSnapshot";

const POLL_MS = Number(process.env.INDEXER_POLL_MS || 12000);

async function indexOne(mint: string) {
  const db = getDb();
  const latest = await db.query(
    `
      SELECT quote_reserve::text, migration_threshold::text, progress, migrated,
             creator_quote_fee::text, total_trading_quote_fee::text, recorded_at
      FROM snapshots
      WHERE creature_mint = $1
      ORDER BY recorded_at DESC
      LIMIT 1
    `,
    [mint]
  );

  const before = latest.rows[0] || null;
  const snapshot = await readCreatureSnapshot(mint);

  const changed =
    !before ||
    String(before.quote_reserve) !== snapshot.quoteReserve ||
    String(before.migration_threshold) !== snapshot.migrationThreshold ||
    String(before.creator_quote_fee) !== snapshot.creatorQuoteFee ||
    String(before.total_trading_quote_fee) !== snapshot.totalTradingQuoteFee ||
    Boolean(before.migrated) !== snapshot.migrated ||
    Math.abs(Number(before.progress || 0) - snapshot.progress) > 0.000001;

  const stale =
    !before ||
    Date.now() - new Date(before.recorded_at).getTime() > 60_000;

  if (!changed && !stale) return;

  await db.query(
    `
      INSERT INTO snapshots
        (creature_mint, quote_reserve, migration_threshold, progress, migrated, creator_quote_fee, total_trading_quote_fee)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      snapshot.baseMint,
      snapshot.quoteReserve,
      snapshot.migrationThreshold,
      snapshot.progress,
      snapshot.migrated,
      snapshot.creatorQuoteFee,
      snapshot.totalTradingQuoteFee,
    ]
  );

  await db.query(
    `
      UPDATE creatures
      SET status = $2, updated_at = NOW()
      WHERE mint = $1
    `,
    [snapshot.baseMint, snapshot.migrated ? "graduated" : "bonding"]
  );

  if (before && String(before.quote_reserve) !== snapshot.quoteReserve) {
    const delta =
      BigInt(snapshot.quoteReserve) - BigInt(String(before.quote_reserve));
    await db.query(
      `
        INSERT INTO events
          (type, creature_mint, pond_mint, amount_in, metadata)
        SELECT
          'water_change',
          c.mint,
          c.pond_mint,
          $2,
          $3::jsonb
        FROM creatures c
        WHERE c.mint = $1
      `,
      [
        snapshot.baseMint,
        delta.toString(),
        JSON.stringify({ source: "indexer", quoteReserve: snapshot.quoteReserve }),
      ]
    );
  }

  if (snapshot.migrated && before && !Boolean(before.migrated)) {
    await db.query(
      `
        INSERT INTO events
          (type, creature_mint, pond_mint, metadata)
        SELECT
          'graduation',
          c.mint,
          c.pond_mint,
          $2::jsonb
        FROM creatures c
        WHERE c.mint = $1
      `,
      [snapshot.baseMint, JSON.stringify({ source: "indexer" })]
    );
  }
}

async function cycle() {
  await ensureSchema();
  const db = getDb();
  const result = await db.query(
    "SELECT mint FROM creatures ORDER BY created_at ASC"
  );

  for (const row of result.rows) {
    try {
      await indexOne(String(row.mint));
    } catch (error) {
      console.error(
        "index creature failed",
        row.mint,
        error instanceof Error ? error.message : error
      );
    }
  }

  console.log(
    JSON.stringify({
      event: "index_cycle",
      creatures: result.rowCount || 0,
      at: new Date().toISOString(),
    })
  );
}

async function main() {
  console.log(
    JSON.stringify({
      event: "indexer_started",
      pollMs: POLL_MS,
      cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet",
    })
  );

  while (true) {
    try {
      await cycle();
    } catch (error) {
      console.error(
        "index cycle failed",
        error instanceof Error ? error.message : error
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
}

void main();
