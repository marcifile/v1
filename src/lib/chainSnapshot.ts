import { PublicKey } from "@solana/web3.js";
import { getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { getServerConnection } from "@/lib/serverSolana";

export async function readCreatureSnapshot(baseMintInput: string) {
  const connection = getServerConnection();
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const baseMint = new PublicKey(baseMintInput);
  const pool = await client.state.getPoolByBaseMint(baseMint);

  if (!pool) {
    throw new Error("Creature pool not found on chain.");
  }

  const state = pool.account.poolState;
  const config = await client.state.getPoolConfig(state.config);
  if (!config) {
    throw new Error("Pond config not found on chain.");
  }

  const quoteInfo = await connection.getAccountInfo(config.quoteMint, "confirmed");
  if (!quoteInfo || !quoteInfo.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new Error("Unsupported quote token program.");
  }

  const quoteMintState = await getMint(
    connection,
    config.quoteMint,
    "confirmed",
    TOKEN_PROGRAM_ID
  );

  const [progress, feeMetrics] = await Promise.all([
    client.state.getPoolQuoteTokenCurveProgress(pool.publicKey),
    client.state.getPoolFeeMetrics(pool.publicKey),
  ]);

  return {
    baseMint: state.baseMint.toBase58(),
    pool: pool.publicKey.toBase58(),
    config: state.config.toBase58(),
    creator: state.creator.toBase58(),
    quoteMint: config.quoteMint.toBase58(),
    quoteDecimals: quoteMintState.decimals,
    quoteReserve: state.quoteReserve.toString(10),
    migrationThreshold: config.migrationQuoteThreshold.toString(10),
    progress,
    migrated: Number(state.isMigrated) !== 0,
    creatorQuoteFee: feeMetrics.current.creatorQuoteFee.toString(10),
    totalTradingQuoteFee: feeMetrics.total.totalTradingQuoteFee.toString(10),
  };
}
