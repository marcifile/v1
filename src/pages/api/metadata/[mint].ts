import type { NextApiRequest, NextApiResponse } from "next";
import { getActiveCluster } from "@/lib/serverSolana";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const mint = String(req.query.mint || "");
  const name = String(req.query.name || "p0nd Creature").slice(0, 32);
  const symbol = String(req.query.symbol || "CREATURE").slice(0, 10).toUpperCase();
  const description = String(
    req.query.description || "A creature living in a p0nd quote-token habitat."
  ).slice(0, 240);
  const cluster = getActiveCluster();

  const host = req.headers.host || "localhost:3000";
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const origin = host.startsWith("localhost") ? "http://" + host : proto + "://" + host;

  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).json({
    name,
    symbol,
    description,
    image: origin + "/p0nd-logo.png",
    external_url: origin + "/creature/" + mint,
    attributes: [
      { trait_type: "world", value: "p0nd" },
      {
        trait_type: "network",
        value: cluster === "mainnet" ? "mainnet-beta" : "devnet",
      },
    ],
  });
}
