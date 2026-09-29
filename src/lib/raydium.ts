import { PublicKey } from "@solana/web3.js";
import { Raydium } from "@raydium-io/raydium-sdk-v2";
import { getServerConnection } from "@/lib/serverSolana";

export async function loadRaydium(owner: PublicKey) {
  return Raydium.load({
    connection: getServerConnection(),
    owner,
    cluster: "mainnet",
    disableFeatureCheck: true,
    disableLoadToken: true,
    blockhashCommitment: "confirmed",
  });
}
