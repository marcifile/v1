import type { NextApiRequest, NextApiResponse } from "next";
import { readCreatureSnapshot } from "@/lib/chainSnapshot";
import { withTransaction } from "@/lib/db";
import { verifyConfirmedTransaction } from "@/lib/verifyTransaction";

type Body = {
  baseMint: string;
  creator: string;
  name: string;
  symbol: string;
  metadataUri?: string;
  imageUri?: string;
  description?: string;
  launchTx?: string;
  pondName?: string;
  pondSymbol?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body as Body;
    const snapshot = await readCreatureSnapshot(body.baseMint);

    if (!body.creator || !body.name?.trim() || !body.symbol?.trim()) {
      return res.status(400).json({ error: "Missing creature identity." });
    }
    if (!body.launchTx) {
      return res.status(400).json({ error: "Missing confirmed launch transaction." });
    }

    const verifiedLaunch = await verifyConfirmedTransaction({
      signature: body.launchTx,
      expectedSigner: body.creator,
      expectedAccounts: [snapshot.baseMint, snapshot.pool, snapshot.config],
    });

    await withTransaction(async (client) => {
      await client.query(
        `
          INSERT INTO ponds (mint, symbol, name, config, quote_decimals)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (mint) DO UPDATE SET
            config = EXCLUDED.config,
            quote_decimals = EXCLUDED.quote_decimals,
            symbol = COALESCE(NULLIF(EXCLUDED.symbol, ''), ponds.symbol),
            name = COALESCE(NULLIF(EXCLUDED.name, ''), ponds.name),
            updated_at = NOW()
        `,
        [
          snapshot.quoteMint,
          body.pondSymbol || "WATER",
          body.pondName || "Pond Water",
          snapshot.config,
          snapshot.quoteDecimals,
        ]
      );

      await client.query(
        `
          INSERT INTO creatures
            (mint, pond_mint, pool, config, creator, name, symbol, metadata_uri, image_uri, description, launch_tx, status)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (mint) DO UPDATE SET
            pool = EXCLUDED.pool,
            config = EXCLUDED.config,
            creator = EXCLUDED.creator,
            name = EXCLUDED.name,
            symbol = EXCLUDED.symbol,
            metadata_uri = COALESCE(EXCLUDED.metadata_uri, creatures.metadata_uri),
            image_uri = COALESCE(EXCLUDED.image_uri, creatures.image_uri),
            description = COALESCE(EXCLUDED.description, creatures.description),
            launch_tx = COALESCE(EXCLUDED.launch_tx, creatures.launch_tx),
            status = EXCLUDED.status,
            updated_at = NOW()
        `,
        [
          snapshot.baseMint,
          snapshot.quoteMint,
          snapshot.pool,
          snapshot.config,
          body.creator,
          body.name.trim().slice(0, 32),
          body.symbol.trim().toUpperCase().slice(0, 10),
          body.metadataUri || null,
          body.imageUri || null,
          body.description?.trim().slice(0, 240) || null,
          body.launchTx || null,
          snapshot.migrated ? "graduated" : "bonding",
        ]
      );

      await client.query(
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

      await client.query(
        `
          INSERT INTO events
            (type, creature_mint, pond_mint, actor, tx_signature, metadata)
          VALUES ('launch', $1, $2, $3, $4, $5::jsonb)
          ON CONFLICT DO NOTHING
        `,
        [
          snapshot.baseMint,
          snapshot.quoteMint,
          body.creator,
          body.launchTx || null,
          JSON.stringify({
            pool: snapshot.pool,
            config: snapshot.config,
            verified: true,
            verifiedSlot: verifiedLaunch.slot,
          }),
        ]
      );
    });

    return res.status(200).json({ ok: true, creature: snapshot });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not register creature.",
    });
  }
}
