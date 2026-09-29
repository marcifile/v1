# POND v1

A cozy pixel-world Solana launchpad where new tokens ("creatures") can launch against existing Solana tokens ("ponds") instead of defaulting to SOL.

## Locked V1 architecture

- Next.js / React
- Meteora Dynamic Bonding Curve SDK 1.5.13
- Meteora DAMM v2 graduation path
- Helius RPC / indexing
- Pinata for token images + metadata
- Railway web service + worker + Postgres
- PixiJS for the living pond scene
- user wallets sign user transactions; no project private key belongs in Railway

## Core model

A pond is the quote token. Example: FROG living in the BONK pond is a FROG/BONK DBC pool.

- buy FROG -> BONK enters DBC quote reserve -> visual water level rises
- sell FROG -> BONK leaves reserve -> water level falls
- migration quote threshold reached -> eligible for DBC -> DAMM v2 graduation

The blockchain is the source of truth. Postgres only indexes/caches searchable world state.

## Current chunk

This first commit intentionally contains:
- Railway-ready Next.js app
- POND page structure and visual shell
- pinned Meteora SDK
- domain types + mock data
- env contract
- health endpoint
- no fake blockchain transactions

The purchased Peaceful Pond source pack is intentionally not committed to this public repository.

## Run

1. Copy .env.example to .env.local
2. npm install
3. npm run dev

Do not store a Solana private key in this project.

## Next chunk

First real devnet DBC path: register one pond/config, hatch one creature, buy/sell it, then read quote reserve and graduation progress back from chain.
