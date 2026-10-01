const { Pool } = require("pg");
const { Keypair } = require("@solana/web3.js");

function svgData(label, emoji, bg) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <rect width="512" height="512" fill="${bg}"/>
    <circle cx="256" cy="235" r="145" fill="#eef0df" opacity="0.9"/>
    <text x="256" y="265" text-anchor="middle" font-size="128">${emoji}</text>
    <text x="256" y="430" text-anchor="middle" font-family="monospace" font-size="42" fill="#20152b">${label}</text>
  </svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("railway.internal")
      ? false
      : { rejectUnauthorized: false },
  });

  const client = await pool.connect();
  try {
    const lilyMint = Keypair.generate().publicKey.toBase58();
    const reedMint = Keypair.generate().publicKey.toBase58();
    const frogMint = Keypair.generate().publicKey.toBase58();
    const dragonMint = Keypair.generate().publicKey.toBase58();
    const frogPool = Keypair.generate().publicKey.toBase58();
    const dragonPool = Keypair.generate().publicKey.toBase58();
    const creatorA = Keypair.generate().publicKey.toBase58();
    const creatorB = Keypair.generate().publicKey.toBase58();

    await client.query("BEGIN");
    await client.query("DELETE FROM snapshots");
    await client.query("DELETE FROM events");
    await client.query("DELETE FROM creatures");
    await client.query("DELETE FROM ponds");

    await client.query(
      `INSERT INTO ponds
        (mint,symbol,name,config,quote_decimals,image_uri,price_usd,liquidity_usd,market_cap_usd,cluster,launch_engine)
       VALUES
        ($1,'LILY','Lily Pond',$2,6,$3,0.0042,184000,4200000,'mainnet','raydium-cpmm'),
        ($4,'REED','Reed Pond',$5,6,$6,0.0018,96000,1800000,'mainnet','raydium-cpmm')`,
      [
        lilyMint, "raydium:" + lilyMint, svgData("LILY", "🪷", "#a8b39e"),
        reedMint, "raydium:" + reedMint, svgData("REED", "🌾", "#b8b39a"),
      ]
    );

    await client.query(
      `INSERT INTO creatures
        (mint,pond_mint,pool,config,creator,name,symbol,image_uri,description,status,cluster,launch_tx)
       VALUES
        ($1,$2,$3,$4,$5,'Frog','FROG',$6,'a frog living in the lily pond','amm','mainnet',NULL),
        ($7,$8,$9,$10,$11,'Dragonfly','FLY',$12,'a dragonfly living in the reed pond','amm','mainnet',NULL)`,
      [
        frogMint, lilyMint, frogPool, "raydium:" + lilyMint, creatorA, svgData("FROG", "🐸", "#9eae91"),
        dragonMint, reedMint, dragonPool, "raydium:" + reedMint, creatorB, svgData("FLY", "🪰", "#b8aa8f"),
      ]
    );

    await client.query(
      `INSERT INTO snapshots
        (creature_mint,quote_reserve,migration_threshold,progress,migrated,creator_quote_fee,total_trading_quote_fee)
       VALUES
        ($1,125000000,0,1,true,0,0),
        ($2,83000000,0,1,true,0,0)`,
      [frogMint, dragonMint]
    );

    await client.query(
      `INSERT INTO events (type,pond_mint,metadata,cluster,created_at)
       VALUES
        ('pond_opened',$1,'{"demo":true}'::jsonb,'mainnet',NOW() - INTERVAL '12 minutes'),
        ('pond_opened',$2,'{"demo":true}'::jsonb,'mainnet',NOW() - INTERVAL '10 minutes')`,
      [lilyMint, reedMint]
    );

    await client.query(
      `INSERT INTO events (type,creature_mint,pond_mint,actor,metadata,cluster,created_at)
       VALUES
        ('launch',$1,$2,$3,'{"demo":true}'::jsonb,'mainnet',NOW() - INTERVAL '8 minutes'),
        ('launch',$4,$5,$6,'{"demo":true}'::jsonb,'mainnet',NOW() - INTERVAL '5 minutes')`,
      [frogMint, lilyMint, creatorA, dragonMint, reedMint, creatorB]
    );

    await client.query("COMMIT");

    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM ponds) AS ponds,
        (SELECT COUNT(*)::int FROM creatures) AS creatures,
        (SELECT COUNT(*)::int FROM snapshots) AS snapshots,
        (SELECT COUNT(*)::int FROM events) AS events
    `);
    console.log("SEED_TWO_PONDS_DONE", JSON.stringify(counts.rows[0]));
  } catch (e) {
    try { await client.query("ROLLBACK"); } catch {}
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("SEED_TWO_PONDS_FAILED", e);
  process.exit(1);
});
