import { PublicKey } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { getServerConnection } from "@/lib/serverSolana";

export async function loadRaydium(
  owner: PublicKey,
  options: { loadTokenAccounts?: boolean } = {}
) {
  const raydium = await Raydium.load({
    connection: getServerConnection(),
    owner,
    cluster: "mainnet",
    disableFeatureCheck: true,
    disableLoadToken: !options.loadTokenAccounts,
    blockhashCommitment: "confirmed",
  });

  if (options.loadTokenAccounts) {
    // Refresh immediately so newly created/received accounts are visible to
    // swap builders even when the SDK instance was just initialized.
    await raydium.account.fetchWalletTokenAccounts({ forceUpdate: true });
  }

  return raydium;
}
