import type { NextApiRequest, NextApiResponse } from "next";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { DynamicBondingCurveClient } from "@meteora-ag/dynamic-bonding-curve-sdk";
import { buildDevnetPondCurve } from "@/lib/dbcPreset";
import { deriveDevnetKeypair, devnetFaucetKeypair } from "@/lib/devnetFaucet";
import { getServerConnection, POND_PROJECT_WALLET } from "@/lib/serverSolana";

const WATER_DECIMALS = 6;
const TARGET_WATER = 1_000_000n * 10n ** BigInt(WATER_DECIMALS);

async function confirmAirdrop(
  connection: ReturnType<typeof getServerConnection>,
  pubkey: PublicKey,
  lamports: number
) {
  const signature = await connection.requestAirdrop(pubkey, lamports);
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed"
  );
}

async function ensureFaucetFunded(
  connection: ReturnType<typeof getServerConnection>,
  faucet: Keypair
) {
  const balance = await connection.getBalance(faucet.publicKey, "confirmed");
  if (balance >= 0.25 * LAMPORTS_PER_SOL) return balance;
  await confirmAirdrop(connection, faucet.publicKey, 2 * LAMPORTS_PER_SOL);
  return connection.getBalance(faucet.publicKey, "confirmed");
}

async function ensureUserGas(
  connection: ReturnType<typeof getServerConnection>,
  owner: PublicKey
) {
  const balance = await connection.getBalance(owner, "confirmed");
  if (balance >= 0.25 * LAMPORTS_PER_SOL) return { balance, airdropped: false };

  try {
    await confirmAirdrop(connection, owner, 1 * LAMPORTS_PER_SOL);
    return {
      balance: await connection.getBalance(owner, "confirmed"),
      airdropped: true,
    };
  } catch {
    return { balance, airdropped: false };
  }
}

async function ensureWaterMint(
  connection: ReturnType<typeof getServerConnection>,
  faucet: Keypair
) {
  const mint = deriveDevnetKeypair("pond-test-water-v1");
  const existing = await connection.getAccountInfo(mint.publicKey, "confirmed");

  if (!existing) {
    const rent = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: faucet.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: rent,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mint.publicKey,
        WATER_DECIMALS,
        faucet.publicKey,
        null,
        TOKEN_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, tx, [faucet, mint], {
      commitment: "confirmed",
    });
  }

  return mint.publicKey;
}

async function ensureWaterBalance(
  connection: ReturnType<typeof getServerConnection>,
  faucet: Keypair,
  owner: PublicKey,
  waterMint: PublicKey
) {
  const ata = getAssociatedTokenAddressSync(
    waterMint,
    owner,
    false,
    TOKEN_PROGRAM_ID
  );
  const ataInfo = await connection.getAccountInfo(ata, "confirmed");

  if (!ataInfo) {
    const tx = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        faucet.publicKey,
        ata,
        owner,
        waterMint
      ),
      createMintToInstruction(
        waterMint,
        ata,
        faucet.publicKey,
        TARGET_WATER
      )
    );
    await sendAndConfirmTransaction(connection, tx, [faucet], {
      commitment: "confirmed",
    });
  } else {
    const current = await connection.getTokenAccountBalance(ata, "confirmed");
    const raw = BigInt(current.value.amount);
    if (raw < TARGET_WATER) {
      const tx = new Transaction().add(
        createMintToInstruction(
          waterMint,
          ata,
          faucet.publicKey,
          TARGET_WATER - raw
        )
      );
      await sendAndConfirmTransaction(connection, tx, [faucet], {
        commitment: "confirmed",
      });
    }
  }

  const final = await connection.getTokenAccountBalance(ata, "confirmed");
  return {
    ata: ata.toBase58(),
    amount: final.value.uiAmountString || "0",
  };
}

async function ensurePondConfig(
  connection: ReturnType<typeof getServerConnection>,
  faucet: Keypair,
  quoteMint: PublicKey
) {
  const config = deriveDevnetKeypair("pond-dbc-config-v1");
  const client = new DynamicBondingCurveClient(connection, "confirmed");
  const existing = await client.state.getPoolConfig(config.publicKey);
  if (existing) return config.publicKey;

  const tx = await client.partner.createConfig({
    config: config.publicKey,
    feeClaimer: POND_PROJECT_WALLET,
    leftoverReceiver: POND_PROJECT_WALLET,
    payer: faucet.publicKey,
    quoteMint,
    ...buildDevnetPondCurve(WATER_DECIMALS),
  });

  await sendAndConfirmTransaction(connection, tx, [faucet, config], {
    commitment: "confirmed",
  });

  return config.publicKey;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const owner = new PublicKey(String(req.body?.owner || ""));
    const connection = getServerConnection();
    const faucet = devnetFaucetKeypair();

    await ensureFaucetFunded(connection, faucet);
    const gas = await ensureUserGas(connection, owner);
    const quoteMint = await ensureWaterMint(connection, faucet);
    const water = await ensureWaterBalance(
      connection,
      faucet,
      owner,
      quoteMint
    );
    const config = await ensurePondConfig(
      connection,
      faucet,
      quoteMint
    );

    return res.status(200).json({
      ready: true,
      quoteMint: quoteMint.toBase58(),
      config: config.toBase58(),
      waterBalance: water.amount,
      waterAta: water.ata,
      userSol: gas.balance / LAMPORTS_PER_SOL,
      userAirdropped: gas.airdropped,
      note: "devnet only · test assets have no value",
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Could not prepare the devnet pond.",
    });
  }
}
