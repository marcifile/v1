import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return res.status(503).json({ ok: false, configured: false });
  }

  try {
    const response = await fetch("https://api.pinata.cloud/data/testAuthentication", {
      headers: { Authorization: "Bearer " + jwt },
    });

    const body = await response.text();

    return res.status(response.ok ? 200 : 502).json({
      ok: response.ok,
      configured: true,
      status: response.status,
      message: response.ok ? "Pinata authentication valid." : body.slice(0, 240),
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      configured: true,
      error: error instanceof Error ? error.message : "Pinata check failed.",
    });
  }
}
