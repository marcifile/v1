import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import { CREATE_CPMM_POOL_PROGRAM } from "@raydium-io/raydium-sdk-v2";
import { humanToBaseUnits } from "@/lib/units";
import { normalizeOptionalHttpUrl } from "@/lib/links";
import { ensureSchema, getDb, withTransaction } from "@/lib/db";
import { getActiveCluster, getServerConnection } from "@/lib/serverSolana";
import { verifyConfirmedTransaction } from "@/lib/verifyTransaction";

type Body = {
  baseMint: string;
  pondMint: string;
  pool: string;
  creator: string;
  name: string;
  symbol: string;
  metadataUri?: string;
  imageUri?: string;
  description?: string;
  website?: string;
  x?: string;
  telegram?: string;
  launchTx: string;
  quoteLiquidity: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body as Body;
    const cluster = getActiveCluster();
    if (cluster !== "mainnet") {
      return res.status(400).json({ error: "Raydium fallback is mainnet only." });
    }

    const baseMint = new PublicKey(body.baseMint);
    const pondMint = new PublicKey(body.pondMint);
    const pool = new PublicKey(body.pool);
    const creator = new PublicKey(body.creator);

    if (!body.name?.trim() || !body.symbol?.trim() || !body.launchTx) {
      return res.status(400).json({ error: "Missing creature launch details." });
    }

    await ensureSchema();
    const pondResult = await getDb().query(
      `
        SELECT mint, symbol, name, config, quote_decimals, launch_engine
        FROM ponds
        WHERE mint = $1 AND cluster = $2
        LIMIT 1
      `,
      [pondMint.toBase58(), cluster]
    );
    const pond = pondResult.rows[0];
    if (!pond || pond.launch_engine !== "raydium-cpmm") {
      return res.status(400).json({ error: "This is not a Raydium fallback pond." });
    }

    const poolAccount = await getServerConnection().getAccountInfo(pool, "confirmed");
    if (!poolAccount || !poolAccount.owner.equals(CREATE_CPMM_POOL_PROGRAM)) {
      return res.status(400).json({ error: "Raydium pool is not confirmed on chain yet." });
    }

    const verified = await verifyConfirmedTransaction({
      signature: body.launchTx,
      expectedSigner: creator.toBase58(),
      expectedAccounts: [baseMint.toBase58(), pondMint.toBase58(), pool.toBase58()],
    });

    const website = normalizeOptionalHttpUrl(body.website, "Website");
    const xUrl = normalizeOptionalHttpUrl(body.x, "X link");
    const telegram = normalizeOptionalHttpUrl(body.telegram, "Telegram link");
    const quoteReserve = humanToBaseUnits(
      body.quoteLiquidity,
      Number(pond.quote_decimals)
    ).toString(10);

    await withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO creatures
            (mint, pond_mint, pool, config, creator, name, symbol, metadata_uri, image_uri, description, website_url, x_url, telegram_url, launch_tx, status, cluster)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'amm',$15)
          ON CONFLICT (mint) DO UPDATE SET
            pool = EXCLUDED.pool,
            pond_mint = EXCLUDED.pond_mint,
            config = EXCLUDED.config,
            creator = EXCLUDED.creator,
            name = EXCLUDED.name,
            symbol = EXCLUDED.symbol,
            metadata_uri = COALESCE(EXCLUDED.metadata_uri, creatures.metadata_uri),
            image_uri = COALESCE(EXCLUDED.image_uri, creatures.image_uri),
            description = COALESCE(EXCLUDED.description, creatures.description),
            website_url = COALESCE(EXCLUDED.website_url, creatures.website_url),
            x_url = COALESCE(EXCLUDED.x_url, creatures.x_url),
            telegram_url = COALESCE(EXCLUDED.telegram_url, creatures.telegram_url),
            launch_tx = EXCLUDED.launch_tx,
            status = 'amm',
            cluster = EXCLUDED.cluster,
            updated_at = NOW()
        `,
        [
          baseMint.toBase58(),
          pondMint.toBase58(),
          pool.toBase58(),
          pond.config,
          creator.toBase58(),
          body.name.trim().slice(0, 32),
          body.symbol.trim().toUpperCase().slice(0, 10),
          body.metadataUri || null,
          body.imageUri || null,
          body.description?.trim().slice(0, 240) || null,
          website,
          xUrl,
          telegram,
          body.launchTx,
          cluster,
        ]
      );

      await client.query(
        `
          INSERT INTO snapshots
            (creature_mint, quote_reserve, migration_threshold, progress, migrated, creator_quote_fee, total_trading_quote_fee)
          VALUES ($1,$2,0,1,true,0,0)
        `,
        [baseMint.toBase58(), quoteReserve]
      );

      await client.query(
        `
          INSERT INTO events
            (type, creature_mint, pond_mint, actor, tx_signature, metadata, cluster)
          VALUES ('launch', $1, $2, $3, $4, $5::jsonb, $6)
          ON CONFLICT DO NOTHING
        `,
        [
          baseMint.toBase58(),
          pondMint.toBase58(),
          creator.toBase58(),
          body.launchTx,
          JSON.stringify({
            pool: pool.toBase58(),
            engine: "raydium-cpmm",
            seededQuoteBaseUnits: quoteReserve,
            verified: true,
            verifiedSlot: verified.slot,
          }),
          cluster,
        ]
      );
    });

    return res.status(200).json({
      ok: true,
      creature: {
        baseMint: baseMint.toBase58(),
        quoteMint: pondMint.toBase58(),
        pool: pool.toBase58(),
        creator: creator.toBase58(),
        engine: "raydium-cpmm",
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not register Raydium creature.",
    });
  }
}
