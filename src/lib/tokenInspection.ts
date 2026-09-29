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
  type P0ndCluster,
} from "@/lib/serverSolana";
import { NATIVE_SOL_MINT } from "@/lib/addressInput";

type HeliusAsset = {
  content?: {
    metadata?: { name?: string; symbol?: string };
    links?: { image?: string };
    files?: Array<{ uri?: string }>;
  };
  token_info?: {
    price_info?: { price_per_token?: number };
  };
};

async function heliusAsset(cluster: P0ndCluster, mint: string) {
  try {
    const response = await fetch(getRpcUrl(cluster), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "p0nd-token-inspect",
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

async function dexMarket(mint: string) {
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

    const tokenIsBase = String(pair.baseToken?.address || "") === mint;

    return {
      dexId: pair.dexId || null,
      pairAddress: pair.pairAddress || null,
      url: pair.url || null,
      priceUsd: tokenIsBase ? Number(pair.priceUsd || 0) || null : null,
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

export async function inspectToken(
  mintInput: PublicKey,
  cluster: P0ndCluster
) {
  const connection = getReadOnlyConnection(cluster);
  const account = await connection.getAccountInfo(mintInput, "confirmed");
  if (!account) throw new Error("Token mint was not found on " + cluster + ".");

  const tokenProgram = account.owner.equals(TOKEN_PROGRAM_ID)
    ? TOKEN_PROGRAM_ID
    : account.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : null;

  if (!tokenProgram) {
    throw new Error("That address is not an SPL or Token-2022 mint.");
  }

  const mintState = await getMint(
    connection,
    mintInput,
    "confirmed",
    tokenProgram
  );

  const [asset, badge, market] = await Promise.all([
    heliusAsset(cluster, mintInput.toBase58()),
    new DynamicBondingCurveClient(connection, "confirmed")
      .state.getTokenBadge(mintInput)
      .catch(() => null),
    cluster === "mainnet"
      ? dexMarket(mintInput.toBase58())
      : Promise.resolve(null),
  ]);

  const isNativeSol = mintInput.equals(NATIVE_SOL_MINT);
  const dexId = String(market?.dexId || "").toLowerCase();
  const origin =
    isNativeSol
      ? "native-sol"
      : dexId.includes("pump")
      ? "pump.fun"
      : "solana";

  const name =
    (isNativeSol ? "Solana" : null) ||
    asset?.content?.metadata?.name?.trim() ||
    market?.baseName ||
    null;
  const symbol =
    (isNativeSol ? "SOL" : null) ||
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
  const standardSpl = account.owner.equals(TOKEN_PROGRAM_ID);

  if (!standardSpl && !badge) {
    warnings.push(
      "This Token-2022 mint needs a Meteora quote-token badge before p0nd can use it as a pond."
    );
  }
  if (!standardSpl && badge) {
    warnings.push(
      "Token-2022 quote mint is supported because Meteora has a token badge for it."
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

  return {
    mint: mintInput.toBase58(),
    cluster,
    tokenProgram: standardSpl ? "spl-token" : "token-2022",
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
    origin,
    isNativeSol,
    launchSupportedNow: standardSpl || Boolean(badge),
    warnings,
    inspectedAt: new Date().toISOString(),
  };
}
