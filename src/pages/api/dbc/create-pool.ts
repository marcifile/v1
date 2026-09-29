import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import {
  deriveDbcPoolAddress,
  deriveTokenBadgeAddress,
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { devnetFaucetKeypair } from "@/lib/devnetFaucet";
import { getServerConnection } from "@/lib/serverSolana";

type Body = {
  config: string;
  baseMint: string;
  payer: string;
  name: string;
  symbol: string;
  uri: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body as Body;
    const configKey = new PublicKey(body.config);
    const baseMintKey = new PublicKey(body.baseMint);
    const poolCreator = new PublicKey(body.payer);
    const sponsor = devnetFaucetKeypair();

    const name = body.name.trim().slice(0, 32);
    const symbol = body.symbol.trim().toUpperCase().slice(0, 10);
    if (!name || !symbol || !body.uri) {
      return res.status(400).json({ error: "Missing creature metadata." });
    }

    const connection = getServerConnection();
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const configState = await client.state.getPoolConfig(configKey);

    if (!configState) {
      return res.status(404).json({ error: "Pond config not found on devnet." });
    }

    const tokenBadgeState = await client.state
      .getTokenBadge(configState.quoteMint)
      .catch(() => null);
    const tokenBadge = tokenBadgeState
      ? deriveTokenBadgeAddress(configState.quoteMint)
      : undefined;

    const tx = await client.creator.createPool({
      baseMint: baseMintKey,
      config: configKey,
      name,
      symbol,
      uri: body.uri,
      payer: sponsor.publicKey,
      poolCreator,
      tokenBadge,
    });

    const latest = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = sponsor.publicKey;
    tx.recentBlockhash = latest.blockhash;
    tx.partialSign(sponsor);

    const pool = deriveDbcPoolAddress(
      configState.quoteMint,
      baseMintKey,
      configKey
    );

    return res.status(200).json({
      transaction: tx
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
      baseMint: baseMintKey.toBase58(),
      config: configKey.toBase58(),
      pool: pool.toBase58(),
      quoteMint: configState.quoteMint.toBase58(),
      sponsored: true,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to build creature launch.",
    });
  }
}
