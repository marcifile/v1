import type { NextApiRequest, NextApiResponse } from "next";
import { readCreatureSnapshot } from "@/lib/chainSnapshot";
import { withTransaction } from "@/lib/db";

type Body = {
  baseMint: string;
  type: "buy" | "sell" | "claim_creator_fee";
  actor?: string;
  txSignature?: string;
  amountIn?: string;
  amountOut?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body as Body;
    const snapshot = await readCreatureSnapshot(body.baseMint);

    await withTransaction(async (client) => {
      const exists = await client.query(
        "SELECT 1 FROM creatures WHERE mint = $1",
        [snapshot.baseMint]
      );
      if (exists.rowCount === 0) {
        throw new Error("Creature is not registered in POND yet.");
      }

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
          UPDATE creatures
          SET status = $2, updated_at = NOW()
          WHERE mint = $1
        `,
        [snapshot.baseMint, snapshot.migrated ? "graduated" : "bonding"]
      );

      await client.query(
        `
          INSERT INTO events
            (type, creature_mint, pond_mint, actor, tx_signature, amount_in, amount_out)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
        `,
        [
          body.type,
          snapshot.baseMint,
          snapshot.quoteMint,
          body.actor || null,
          body.txSignature || null,
          body.amountIn || null,
          body.amountOut || null,
        ]
      );
    });

    return res.status(200).json({ ok: true, snapshot });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Could not record event.",
    });
  }
}
