import type { NextApiRequest, NextApiResponse } from "next";
import { hasPinata, ipfsGateway, pinFile, pinJson } from "@/lib/pinata";
import { consumeRateLimit } from "@/lib/rateLimit";
import { normalizeOptionalHttpUrl } from "@/lib/links";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "6mb",
    },
  },
};

type Body = {
  baseMint: string;
  name: string;
  symbol: string;
  description?: string;
  website?: string;
  x?: string;
  telegram?: string;
  imageDataUrl?: string;
};

function parseDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid image data.");
  const mimeType = match[1];
  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mimeType)) {
    throw new Error("Unsupported image type.");
  }
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 5 * 1024 * 1024) {
    throw new Error("Image must be 5MB or smaller.");
  }
  return { mimeType, bytes };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rate = consumeRateLimit(req, "metadata-publish", 40, 3600000);
  if (!rate.ok) {
    res.setHeader("Retry-After", String(rate.retryAfterSeconds));
    return res.status(429).json({
      error: "Too many requests. Try again later.",
    });
  }

  try {
    const body = req.body as Body;
    const name = body.name?.trim().slice(0, 32);
    const symbol = body.symbol?.trim().toUpperCase().slice(0, 10);
    const description = (body.description || "").trim().slice(0, 240);
    const website = normalizeOptionalHttpUrl(body.website, "Website");
    const xUrl = normalizeOptionalHttpUrl(body.x, "X link");
    const telegram = normalizeOptionalHttpUrl(body.telegram, "Telegram link");
    const baseMint = String(body.baseMint || "");

    if (!baseMint || !name || !symbol) {
      return res.status(400).json({ error: "Missing metadata fields." });
    }

    const host = req.headers.host || "localhost:3000";
    const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
    const origin = host.startsWith("localhost") ? "http://" + host : proto + "://" + host;

    if (!hasPinata()) {
      const params = new URLSearchParams({ name, symbol });
      if (description) params.set("description", description);
      return res.status(200).json({
        storage: "hosted-fallback",
        metadataUri:
          origin +
          "/api/metadata/" +
          encodeURIComponent(baseMint) +
          "?" +
          params.toString(),
        imageUri: origin + "/pond-mark.svg",
        warning: "Pinata is not configured yet.",
      });
    }

    let imageUri = origin + "/pond-mark.svg";

    if (body.imageDataUrl) {
      const parsed = parseDataUrl(body.imageDataUrl);
      const extension =
        parsed.mimeType === "image/png"
          ? "png"
          : parsed.mimeType === "image/jpeg"
          ? "jpg"
          : parsed.mimeType === "image/webp"
          ? "webp"
          : "gif";

      const imageCid = await pinFile({
        bytes: parsed.bytes,
        fileName: symbol.toLowerCase() + "-" + baseMint.slice(0, 8) + "." + extension,
        mimeType: parsed.mimeType,
      });
      imageUri = ipfsGateway(imageCid);
    }

    const metadata = {
      name,
      symbol,
      description: description || "A creature living in POND.",
      image: imageUri,
      external_url: website || origin + "/creature/" + baseMint,
      attributes: [
        { trait_type: "world", value: "POND" },
        { trait_type: "network", value: "devnet" },
      ],
      properties: {
        pond: origin + "/creature/" + baseMint,
        website,
        x: xUrl,
        telegram,
      },
    };

    const metadataCid = await pinJson(
      metadata,
      symbol.toLowerCase() + "-" + baseMint.slice(0, 8) + "-metadata"
    );

    return res.status(200).json({
      storage: "ipfs",
      metadataCid,
      metadataUri: ipfsGateway(metadataCid),
      imageUri,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Metadata publish failed.",
    });
  }
}
