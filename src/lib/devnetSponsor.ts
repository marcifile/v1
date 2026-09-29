import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { devnetFaucetKeypair } from "@/lib/devnetFaucet";
import { getDevnetConnection } from "@/lib/serverSolana";

export async function ensureDevnetSponsor(minSol = 0.25) {
  const connection = getDevnetConnection();
  const sponsor = devnetFaucetKeypair();
  let balance = await connection.getBalance(sponsor.publicKey, "confirmed");

  if (balance >= minSol * LAMPORTS_PER_SOL) {
    return { connection, sponsor, balance };
  }

  const signature = await connection.requestAirdrop(
    sponsor.publicKey,
    2 * LAMPORTS_PER_SOL
  );
  const latest = await connection.getLatestBlockhash("confirmed");
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    "confirmed"
  );

  balance = await connection.getBalance(sponsor.publicKey, "confirmed");
  return { connection, sponsor, balance };
}

export function parsePublicKey(value: unknown, label: string) {
  try {
    return new PublicKey(String(value || ""));
  } catch {
    throw new Error(label + " is not a valid Solana address.");
  }
}
