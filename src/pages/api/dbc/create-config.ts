import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  deriveTokenBadgeAddress,
  DynamicBondingCurveClient,
} from "@meteora-ag/dynamic-bonding-curve-sdk";
import { buildDevnetPondCurve, DEVNET_POND_PRESET } from "@/lib/dbcPreset";
import { getServerConnection, POND_PROJECT_WALLET } from "@/lib/serverSolana";

type Body = {
  quoteMint: string;
  config: string;
  payer: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { quoteMint, config, payer } = req.body as Body;
    const quoteMintKey = new PublicKey(quoteMint);
    const configKey = new PublicKey(config);
    const payerKey = new PublicKey(payer);

    const connection = getServerConnection();
    const quoteMintAccount = await connection.getAccountInfo(quoteMintKey, "confirmed");

    if (!quoteMintAccount) {
      return res.status(400).json({ error: "Quote mint does not exist on devnet." });
    }

    if (!quoteMintAccount.owner.equals(TOKEN_PROGRAM_ID)) {
      return res.status(400).json({
        error: "Devnet v1 currently accepts standard SPL quote tokens only.",
      });
    }

    const mint = await getMint(
      connection,
      quoteMintKey,
      "confirmed",
      TOKEN_PROGRAM_ID
    );

    const curveConfig = buildDevnetPondCurve(mint.decimals);
    const client = new DynamicBondingCurveClient(connection, "confirmed");
    const tokenBadgeState = await client.state
      .getTokenBadge(quoteMintKey)
      .catch(() => null);
    const tokenBadge = tokenBadgeState
      ? deriveTokenBadgeAddress(quoteMintKey)
      : undefined;
    const tx = await client.partner.createConfig({
      config: configKey,
      feeClaimer: POND_PROJECT_WALLET,
      leftoverReceiver: POND_PROJECT_WALLET,
      payer: payerKey,
      quoteMint: quoteMintKey,
      tokenBadge,
      ...curveConfig,
    });

    const latest = await connection.getLatestBlockhash("confirmed");
    tx.feePayer = payerKey;
    tx.recentBlockhash = latest.blockhash;

    return res.status(200).json({
      transaction: tx
        .serialize({ requireAllSignatures: false, verifySignatures: false })
        .toString("base64"),
      config: configKey.toBase58(),
      quoteMint: quoteMintKey.toBase58(),
      quoteDecimals: mint.decimals,
      preset: DEVNET_POND_PRESET,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to build pond config.",
    });
  }
}
