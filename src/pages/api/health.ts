import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    ok: true,
    service: "pond-web",
    chain: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
    time: new Date().toISOString(),
  });
}
