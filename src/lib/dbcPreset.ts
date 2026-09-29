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

export const DEVNET_POND_PRESET = {
  id: "pond-devnet-v1",
  totalTokenSupply: 1_000_000_000,
  migrationQuoteThreshold: 1_000,
  percentageSupplyOnMigration: 20,
  tradingFeeBps: 100,
  creatorTradingFeePercentage: 50,
} as const;

export function buildDevnetPondCurve(quoteDecimals: number) {
  if (!Number.isInteger(quoteDecimals) || quoteDecimals < 0 || quoteDecimals > 18) {
    throw new Error("Unsupported quote mint decimals.");
  }

  return buildCurve({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: quoteDecimals,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: DEVNET_POND_PRESET.totalTokenSupply,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: DEVNET_POND_PRESET.tradingFeeBps,
          endingFeeBps: DEVNET_POND_PRESET.tradingFeeBps,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage:
        DEVNET_POND_PRESET.creatorTradingFeePercentage,
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
    percentageSupplyOnMigration:
      DEVNET_POND_PRESET.percentageSupplyOnMigration,
    migrationQuoteThreshold:
      DEVNET_POND_PRESET.migrationQuoteThreshold,
  });
}
