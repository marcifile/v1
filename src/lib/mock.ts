import type { Creature, Pond } from "@/types/pond";

export const ponds: Pond[] = [
  { mint: "bonk", symbol: "BONK", name: "Bonk", creatureCount: 12, quoteReserve: 8420000 },
  { mint: "wif", symbol: "WIF", name: "dogwifhat", creatureCount: 7, quoteReserve: 2810000 },
  { mint: "usdc", symbol: "USDC", name: "USD Coin", creatureCount: 4, quoteReserve: 118000 },
];

export const creatures: Creature[] = [
  { mint: "frog-demo", pondMint: "bonk", name: "Frog", symbol: "FROG", species: "frog", state: "excited", marketCapUsd: 92400, volume24hUsd: 41800, quoteReserve: 282811, graduationProgress: 0.68, trades1h: 382 },
  { mint: "guppy-demo", pondMint: "bonk", name: "Guppy", symbol: "GUPPY", species: "fish", state: "swimming", marketCapUsd: 51700, volume24hUsd: 18700, quoteReserve: 128200, graduationProgress: 0.42, trades1h: 141 },
  { mint: "turtle-demo", pondMint: "wif", name: "Turtle", symbol: "TURTLE", species: "turtle", state: "sleeping", marketCapUsd: 24100, volume24hUsd: 5100, quoteReserve: 64000, graduationProgress: 0.19, trades1h: 28 }
];
