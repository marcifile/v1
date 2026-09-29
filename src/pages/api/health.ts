import type { NextApiRequest, NextApiResponse } from "next";
import { ensureSchema, getDb } from "@/lib/db";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getServerConnection } from "@/lib/serverSolana";
import { devnetFaucetKeypair } from "@/lib/devnetFaucet";

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label + " timed out")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const checks = {
    database: { ok: false, detail: "" },
    solanaRpc: { ok: false, detail: "" },
    indexer: { ok: false, detail: "" },
    pinata: { ok: false, detail: "" },
    sponsor: { ok: false, detail: "" },
  };

  try {
    await withTimeout(ensureSchema(), 5000, "database");
    const db = getDb();

    const dbResult = await withTimeout(
      db.query("SELECT (SELECT COUNT(*)::int FROM creatures) AS creatures"),
      5000,
      "database query"
    );

    checks.database = {
      ok: true,
      detail: dbResult.rows[0].creatures + " creatures registered",
    };

    const indexerResult = await withTimeout(
      db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM creatures) AS creature_count,
          MAX(recorded_at) AS last_snapshot
        FROM snapshots
      `),
      5000,
      "indexer query"
    );

    const creatureCount = Number(indexerResult.rows[0]?.creature_count || 0);
    const lastSnapshot = indexerResult.rows[0]?.last_snapshot
      ? new Date(indexerResult.rows[0].last_snapshot)
      : null;
    const ageSeconds = lastSnapshot
      ? Math.max(0, Math.round((Date.now() - lastSnapshot.getTime()) / 1000))
      : null;

    checks.indexer = {
      ok:
        creatureCount === 0 ||
        (ageSeconds !== null && ageSeconds <= 120),
      detail:
        creatureCount === 0
          ? "waiting for first creature"
          : ageSeconds === null
          ? "no snapshots found"
          : "latest snapshot " + ageSeconds + "s ago",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "database check failed";
    checks.database = { ok: false, detail: message };
    checks.indexer = { ok: false, detail: "database unavailable" };
  }

  try {
    const connection = getServerConnection();
    const slot = await withTimeout(
      connection.getSlot("confirmed"),
      6000,
      "Solana RPC"
    );
    checks.solanaRpc = { ok: true, detail: "confirmed slot " + slot };
  } catch (error) {
    checks.solanaRpc = {
      ok: false,
      detail:
        error instanceof Error ? error.message : "RPC check failed",
    };
  }

  try {
    const connection = getServerConnection();
    const sponsor = devnetFaucetKeypair();
    const lamports = await withTimeout(
      connection.getBalance(sponsor.publicKey, "confirmed"),
      6000,
      "sponsor balance"
    );
    const sol = lamports / LAMPORTS_PER_SOL;
    checks.sponsor = {
      ok: sol >= 0.05,
      detail: sol.toFixed(3) + " devnet SOL available",
    };
  } catch (error) {
    checks.sponsor = {
      ok: false,
      detail:
        error instanceof Error ? error.message : "sponsor check failed",
    };
  }

  if (!process.env.PINATA_JWT) {
    checks.pinata = { ok: false, detail: "PINATA_JWT not configured" };
  } else {
    try {
      const response = await withTimeout(
        fetch("https://api.pinata.cloud/data/testAuthentication", {
          headers: {
            Authorization: "Bearer " + process.env.PINATA_JWT,
          },
        }),
        6000,
        "Pinata"
      );

      checks.pinata = {
        ok: response.ok,
        detail: response.ok
          ? "authentication valid"
          : "authentication rejected",
      };
    } catch (error) {
      checks.pinata = {
        ok: false,
        detail:
          error instanceof Error ? error.message : "Pinata check failed",
      };
    }
  }

  const criticalOk =
    checks.database.ok &&
    checks.solanaRpc.ok &&
    checks.indexer.ok &&
    checks.pinata.ok &&
    checks.sponsor.ok;

  return res.status(criticalOk ? 200 : 503).json({
    ok: criticalOk,
    service: "pond-web",
    cluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet",
    checks,
    checkedAt: new Date().toISOString(),
  });
}
