import {
  ActivationType,
  BaseFeeMode,
  buildCurve,
  CollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

export const P0ND_CURVE_DEFAULTS = {
  totalTokenSupply: 1_000_000_000,
  percentageSupplyOnMigration: 20,
  tradingFeeBps: 100,
  creatorTradingFeePercentage: 50,
} as const;

export const DEVNET_POND_PRESET = {
  id: "p0nd-devnet-v1",
  ...P0ND_CURVE_DEFAULTS,
  migrationQuoteThreshold: 1_000,
} as const;

function validateDecimals(quoteDecimals: number) {
  if (!Number.isInteger(quoteDecimals) || quoteDecimals < 0 || quoteDecimals > 18) {
    throw new Error("Unsupported quote mint decimals.");
  }
}

export function buildPondCurve(args: {
  quoteDecimals: number;
  migrationQuoteThreshold: number;
}) {
  validateDecimals(args.quoteDecimals);
  if (!Number.isFinite(args.migrationQuoteThreshold) || args.migrationQuoteThreshold <= 0) {
    throw new Error("Migration quote threshold must be greater than zero.");
  }

  return buildCurve({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: args.quoteDecimals,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: P0ND_CURVE_DEFAULTS.totalTokenSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: P0ND_CURVE_DEFAULTS.tradingFeeBps,
          endingFeeBps: P0ND_CURVE_DEFAULTS.tradingFeeBps,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: P0ND_CURVE_DEFAULTS.creatorTradingFeePercentage,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: {
        feePercentage: 0,
        creatorFeePercentage: 0,
      },
    },
    liquidityDistribution: {
      partnerLiquidityPercentage: 0,
      partnerPermanentLockedLiquidityPercentage: 10,
      creatorLiquidityPercentage: 90,
      creatorPermanentLockedLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    percentageSupplyOnMigration: P0ND_CURVE_DEFAULTS.percentageSupplyOnMigration,
    migrationQuoteThreshold: args.migrationQuoteThreshold,
  });
}

export function buildDevnetPondCurve(quoteDecimals: number) {
  return buildPondCurve({
    quoteDecimals,
    migrationQuoteThreshold: DEVNET_POND_PRESET.migrationQuoteThreshold,
  });
}
