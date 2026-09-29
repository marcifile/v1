export type Pond = {
  mint: string;
  symbol: string;
  name: string;
  creatureCount: number;
  quoteReserve: number;
};

export type CreatureState = "idle" | "swimming" | "sleeping" | "excited" | "hiding" | "graduating";

export type Creature = {
  mint: string;
  pondMint: string;
  name: string;
  symbol: string;
  species: string;
  state: CreatureState;
  marketCapUsd: number;
  volume24hUsd: number;
  quoteReserve: number;
  graduationProgress: number;
  trades1h: number;
};
