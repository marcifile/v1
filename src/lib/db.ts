import { Pool, type PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pondPgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __pondSchemaReady: Promise<void> | undefined;
}

export function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!global.__pondPgPool) {
    global.__pondPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: process.env.DATABASE_URL.includes("railway.internal")
        ? false
        : { rejectUnauthorized: false },
    });
  }

  return global.__pondPgPool;
}

export async function ensureSchema() {
  if (!global.__pondSchemaReady) {
    global.__pondSchemaReady = (async () => {
      const db = getDb();
      await db.query(`
        CREATE TABLE IF NOT EXISTS ponds (
          mint TEXT PRIMARY KEY,
          symbol TEXT,
          name TEXT,
          config TEXT UNIQUE NOT NULL,
          quote_decimals INTEGER NOT NULL DEFAULT 0,
          image_uri TEXT,
          price_usd DOUBLE PRECISION,
          liquidity_usd DOUBLE PRECISION,
          market_cap_usd DOUBLE PRECISION,
          cluster TEXT NOT NULL DEFAULT 'devnet',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS creatures (
          mint TEXT PRIMARY KEY,
          pond_mint TEXT NOT NULL REFERENCES ponds(mint) ON DELETE RESTRICT,
          pool TEXT UNIQUE NOT NULL,
          config TEXT NOT NULL,
          creator TEXT NOT NULL,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          metadata_uri TEXT,
          image_uri TEXT,
          description TEXT,
          website_url TEXT,
          x_url TEXT,
          telegram_url TEXT,
          launch_tx TEXT,
          status TEXT NOT NULL DEFAULT 'bonding',
          cluster TEXT NOT NULL DEFAULT 'devnet',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE creatures ADD COLUMN IF NOT EXISTS image_uri TEXT;
        ALTER TABLE creatures ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE creatures ADD COLUMN IF NOT EXISTS website_url TEXT;
        ALTER TABLE creatures ADD COLUMN IF NOT EXISTS x_url TEXT;
        ALTER TABLE ponds ADD COLUMN IF NOT EXISTS image_uri TEXT;
        ALTER TABLE ponds ADD COLUMN IF NOT EXISTS price_usd DOUBLE PRECISION;
        ALTER TABLE ponds ADD COLUMN IF NOT EXISTS liquidity_usd DOUBLE PRECISION;
        ALTER TABLE ponds ADD COLUMN IF NOT EXISTS market_cap_usd DOUBLE PRECISION;
        ALTER TABLE ponds ADD COLUMN IF NOT EXISTS cluster TEXT NOT NULL DEFAULT 'devnet';
        ALTER TABLE creatures ADD COLUMN IF NOT EXISTS telegram_url TEXT;
        ALTER TABLE creatures ADD COLUMN IF NOT EXISTS cluster TEXT NOT NULL DEFAULT 'devnet';

        CREATE TABLE IF NOT EXISTS snapshots (
          id BIGSERIAL PRIMARY KEY,
          creature_mint TEXT NOT NULL REFERENCES creatures(mint) ON DELETE CASCADE,
          quote_reserve NUMERIC(40, 0) NOT NULL DEFAULT 0,
          migration_threshold NUMERIC(40, 0) NOT NULL DEFAULT 0,
          progress DOUBLE PRECISION NOT NULL DEFAULT 0,
          migrated BOOLEAN NOT NULL DEFAULT FALSE,
          creator_quote_fee NUMERIC(40, 0) NOT NULL DEFAULT 0,
          total_trading_quote_fee NUMERIC(40, 0) NOT NULL DEFAULT 0,
          recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS creator_quote_fee NUMERIC(40, 0) NOT NULL DEFAULT 0;
        ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS total_trading_quote_fee NUMERIC(40, 0) NOT NULL DEFAULT 0;

        CREATE INDEX IF NOT EXISTS snapshots_creature_time_idx
          ON snapshots(creature_mint, recorded_at DESC);

        CREATE TABLE IF NOT EXISTS events (
          id BIGSERIAL PRIMARY KEY,
          type TEXT NOT NULL,
          creature_mint TEXT REFERENCES creatures(mint) ON DELETE CASCADE,
          pond_mint TEXT REFERENCES ponds(mint) ON DELETE CASCADE,
          actor TEXT,
          tx_signature TEXT,
          amount_in TEXT,
          amount_out TEXT,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          cluster TEXT NOT NULL DEFAULT 'devnet',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE events ADD COLUMN IF NOT EXISTS cluster TEXT NOT NULL DEFAULT 'devnet';

        CREATE INDEX IF NOT EXISTS ponds_cluster_idx ON ponds(cluster);
        CREATE INDEX IF NOT EXISTS creatures_cluster_idx ON creatures(cluster);
        CREATE INDEX IF NOT EXISTS events_cluster_time_idx ON events(cluster, created_at DESC);

        CREATE INDEX IF NOT EXISTS events_time_idx
          ON events(created_at DESC);
        CREATE INDEX IF NOT EXISTS events_creature_idx
          ON events(creature_mint, created_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS events_tx_type_unique_idx
          ON events(tx_signature, type)
          WHERE tx_signature IS NOT NULL;
      `);
    })().catch((error) => {
      global.__pondSchemaReady = undefined;
      throw error;
    });
  }

  return global.__pondSchemaReady;
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  await ensureSchema();
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
