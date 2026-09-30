const { Pool } = require("pg");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("railway.internal")
      ? false
      : { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    const before = await client.query(`
      SELECT 'ponds' AS table_name, COUNT(*)::int AS row_count FROM ponds
      UNION ALL
      SELECT 'creatures', COUNT(*)::int FROM creatures
      UNION ALL
      SELECT 'snapshots', COUNT(*)::int FROM snapshots
      UNION ALL
      SELECT 'events', COUNT(*)::int FROM events
      ORDER BY table_name
    `);
    console.log("RESET_WORLD_BEFORE", JSON.stringify(before.rows));

    await client.query("BEGIN");
    await client.query("DELETE FROM snapshots");
    await client.query("DELETE FROM events");
    await client.query("DELETE FROM creatures");
    await client.query("DELETE FROM ponds");
    await client.query("COMMIT");

    const after = await client.query(`
      SELECT 'ponds' AS table_name, COUNT(*)::int AS row_count FROM ponds
      UNION ALL
      SELECT 'creatures', COUNT(*)::int FROM creatures
      UNION ALL
      SELECT 'snapshots', COUNT(*)::int FROM snapshots
      UNION ALL
      SELECT 'events', COUNT(*)::int FROM events
      ORDER BY table_name
    `);
    console.log("RESET_WORLD_AFTER", JSON.stringify(after.rows));
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("RESET_WORLD_FAILED", error);
  process.exit(1);
});
