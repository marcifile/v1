export type WorldPond = {
  mint: string;
  symbol: string | null;
  name: string | null;
  config: string;
  launch_engine: "meteora-dbc" | "raydium-cpmm";
  quote_decimals: number;
  image_uri: string | null;
  price_usd: number | null;
  liquidity_usd: number | null;
  market_cap_usd: number | null;
  creature_count: number;
  quote_reserve_base_units: string;
  total_trading_quote_fee_base_units: string;
};

export type WorldCreature = {
  mint: string;
  pond_mint: string;
  pool: string;
  config: string;
  creator: string;
  name: string;
  symbol: string;
  metadata_uri: string | null;
  image_uri: string | null;
  description: string | null;
  website_url: string | null;
  x_url: string | null;
  telegram_url: string | null;
  launch_tx: string | null;
  status: string;
  created_at: string;
  pond_symbol: string | null;
  pond_name: string | null;
  quote_decimals: number;
  quote_reserve_base_units: string;
  migration_threshold_base_units: string;
  progress: number;
  migrated: boolean;
  creator_quote_fee_base_units: string;
  total_trading_quote_fee_base_units: string;
  snapshot_at: string | null;
};

export type WorldEvent = {
  id: string | number;
  type: string;
  creature_mint: string | null;
  pond_mint: string | null;
  actor: string | null;
  tx_signature: string | null;
  amount_in: string | null;
  amount_out: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type WorldPayload = {
  ponds: WorldPond[];
  creatures: WorldCreature[];
  events: WorldEvent[];
  cluster?: "devnet" | "mainnet";
  generatedAt: string;
};
