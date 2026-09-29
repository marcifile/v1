import type { NextApiRequest, NextApiResponse } from "next";
import { PublicKey } from "@solana/web3.js";
import {
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import {
  getReadOnlyConnection,
  getRpcUrl,
} from "@/lib/serverSolana";
import { consumeRateLimit } from "@/lib/rateLimit";

type HeliusAsset = {
  interface?: string;
  content?: {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
    files?: Array<{ uri?: string; mime?: string }>;
  };
  token_info?: {
    decimals?: number;
    supply?: number;
    price_info?: { price_per_token?: number };
  };
};

async function getHeliusAsset(rpcUrl: string, mint: string) {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "pond-token-inspect",
        method: "getAsset",
        params: {
          id: mint,
          displayOptions: { showFungible: true },
        },
      }),
    });
    const data = await response.json();
    return (data?.result || null) as HeliusAsset | null;
  } catch {
    return null;
  }
}

async function getDexMarket(mint: string) {
  try {
    const response = await fetch(
      "https://api.dexscreener.com/latest/dex/tokens/" +
        encodeURIComponent(mint),
      { headers: { Accept: "application/json" } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const pairs = Array.isArray(data?.pairs)
      ? data.pairs.filter((pair: any) => pair?.chainId === "solana")
      : [];

    pairs.sort(
      (a: any, b: any) =>
        Number(b?.liquidity?.usd || 0) - Number(a?.liquidity?.usd || 0)
    );

    const pair = pairs[0];
    if (!pair) return null;

    return {
      dexId: pair.dexId || null,
      pairAddress: pair.pairAddress || null,
      url: pair.url || null,
      priceUsd: Number(pair.priceUsd || 0) || null,
      liquidityUsd: Number(pair.liquidity?.usd || 0) || null,
      fdv: Number(pair.fdv || 0) || null,
      marketCap: Number(pair.marketCap || 0) || null,
      baseSymbol: pair.baseToken?.symbol || null,
      baseName: pair.baseToken?.name || null,
      quoteSymbol: pair.quoteToken?.symbol || null,
      imageUrl: pair.info?.imageUrl || null,
    };
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rate = consumeRateLimit(req, "token-inspect", 90, 60 * 60 * 1000);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({ error: "Too many token inspections. Try again later." });
  }

  try {
    const mint = new PublicKey(String(req.query.mint || ""));
    const cluster =
      String(req.query.cluster || "devnet") === "mainnet"
        ? "mainnet"
        : "devnet";

    const connection = getReadOnlyConnection(cluster);
    const account = await connection.getAccountInfo(mint, "confirmed");
    if (!account) {
      return res.status(404).json({
        error: "Token mint was not found on " + cluster + ".",
      });
    }

    const tokenProgram = account.owner.equals(TOKEN_PROGRAM_ID)
      ? TOKEN_PROGRAM_ID
      : account.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? TOKEN_2022_PROGRAM_ID
      : null;

    if (!tokenProgram) {
      return res.status(400).json({
        error: "That address is not an SPL or Token-2022 mint.",
      });
    }

    const mintState = await getMint(
      connection,
      mint,
      "confirmed",
      tokenProgram
    );

    const [asset, badge, market] = await Promise.all([
      getHeliusAsset(getRpcUrl(cluster), mint.toBase58()),
      new DynamicBondingCurveClient(connection, "confirmed")
        .state.getTokenBadge(mint)
        .catch(() => null),
      cluster === "mainnet" ? getDexMarket(mint.toBase58()) : Promise.resolve(null),
    ]);

    const name =
      asset?.content?.metadata?.name?.trim() ||
      market?.baseName ||
      null;
    const symbol =
      asset?.content?.metadata?.symbol?.trim() ||
      market?.baseSymbol ||
      null;
    const imageUri =
      asset?.content?.links?.image ||
      asset?.content?.files?.[0]?.uri ||
      market?.imageUrl ||
      null;
    const priceUsd =
      asset?.token_info?.price_info?.price_per_token ||
      market?.priceUsd ||
      null;

    const warnings: string[] = [];
    if (!account.owner.equals(TOKEN_PROGRAM_ID)) {
      warnings.push(
        "Current POND v1 launch path only supports standard SPL quote tokens."
      );
    }
    if (mintState.freezeAuthority) {
      warnings.push("This mint still has an active freeze authority.");
    }
    if (mintState.mintAuthority) {
      warnings.push("This mint still has an active mint authority.");
    }
    if (cluster === "mainnet" && !market?.liquidityUsd) {
      warnings.push("No liquid Solana market was found by the market-data check.");
    }

    return res.status(200).json({
      mint: mint.toBase58(),
      cluster,
      tokenProgram: account.owner.equals(TOKEN_PROGRAM_ID)
        ? "spl-token"
        : "token-2022",
      decimals: mintState.decimals,
      supplyBaseUnits: mintState.supply.toString(),
      mintAuthority: mintState.mintAuthority?.toBase58() || null,
      freezeAuthority: mintState.freezeAuthority?.toBase58() || null,
      name,
      symbol,
      imageUri,
      priceUsd,
      tokenBadgeExists: Boolean(badge),
      market,
      launchSupportedNow:
        cluster === "devnet" && account.owner.equals(TOKEN_PROGRAM_ID),
      warnings,
      inspectedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(400).json({
      error:
        error instanceof Error ? error.message : "Could not inspect token.",
    });
  }
}
