import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const mint = String(req.query.mint || "");
  const name = String(req.query.name || "Pond Creature").slice(0, 32);
  const symbol = String(req.query.symbol || "POND").slice(0, 10).toUpperCase();

  const host = req.headers.host || "localhost:3000";
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const origin = host.startsWith("localhost") ? "http://" + host : proto + "://" + host;

  res.setHeader("Cache-Control", "public, max-age=60");
  res.status(200).json({
    name,
    symbol,
    description: "A creature living in a POND quote-token habitat.",
    image: origin + "/pond-mark.svg",
    external_url: origin + "/creature/" + mint,
    attributes: [
      { trait_type: "world", value: "POND" },
      { trait_type: "network", value: "devnet" },
    ],
  });
}
