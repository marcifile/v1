import { PublicKey } from "@solana/web3.js";
import { getServerConnection } from "@/lib/serverSolana";

export async function verifyConfirmedTransaction(args: {
  signature: string;
  expectedSigner: string;
  expectedAccounts?: string[];
}) {
  if (!args.signature?.trim()) {
    throw new Error("A confirmed transaction signature is required.");
  }

  const signer = new PublicKey(args.expectedSigner);
  const expectedAccounts = (args.expectedAccounts || []).map(
    (value) => new PublicKey(value).toBase58()
  );

  const connection = getServerConnection();
  const parsed = await connection.getParsedTransaction(args.signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!parsed) {
    throw new Error("Transaction was not found or is not confirmed yet.");
  }
  if (parsed.meta?.err) {
    throw new Error("Transaction failed on chain.");
  }

  const keys = parsed.transaction.message.accountKeys.map((entry) => ({
    pubkey: entry.pubkey.toBase58(),
    signer: entry.signer,
  }));

  const signerEntry = keys.find(
    (entry) => entry.pubkey === signer.toBase58() && entry.signer
  );
  if (!signerEntry) {
    throw new Error("Expected wallet did not sign this transaction.");
  }

  for (const expected of expectedAccounts) {
    if (!keys.some((entry) => entry.pubkey === expected)) {
      throw new Error("Transaction does not reference the expected POND account.");
    }
  }

  return {
    signature: args.signature,
    slot: parsed.slot,
    blockTime: parsed.blockTime,
    signer: signer.toBase58(),
  };
}
