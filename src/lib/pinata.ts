type PinFileResult = {
  IpfsHash: string;
};

type PinJsonResult = {
  IpfsHash: string;
};

function jwt() {
  const value = process.env.PINATA_JWT;
  if (!value) throw new Error("PINATA_JWT is not configured.");
  return value;
}

export function hasPinata() {
  return Boolean(process.env.PINATA_JWT);
}

export function ipfsGateway(cid: string) {
  const configured = process.env.PINATA_GATEWAY?.trim();
  if (configured) {
    const base = configured.startsWith("http")
      ? configured.replace(/\/$/, "")
      : "https://" + configured.replace(/\/$/, "");
    return base + "/ipfs/" + cid;
  }
  return "https://gateway.pinata.cloud/ipfs/" + cid;
}

export async function pinFile(args: {
  bytes: Buffer;
  fileName: string;
  mimeType: string;
}) {
  const form = new FormData();
  const blob = new Blob([args.bytes], { type: args.mimeType });
  form.append("file", blob, args.fileName);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: args.fileName })
  );

  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinFileToIPFS",
    {
      method: "POST",
      headers: { Authorization: "Bearer " + jwt() },
      body: form,
    }
  );

  const data = (await response.json()) as PinFileResult & { error?: unknown };
  if (!response.ok || !data.IpfsHash) {
    throw new Error(
      "Pinata image upload failed: " + JSON.stringify(data.error ?? data)
    );
  }

  return data.IpfsHash;
}

export async function pinJson(
  content: Record<string, unknown>,
  name: string
) {
  const response = await fetch(
    "https://api.pinata.cloud/pinning/pinJSONToIPFS",
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + jwt(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pinataContent: content,
        pinataMetadata: { name },
      }),
    }
  );

  const data = (await response.json()) as PinJsonResult & { error?: unknown };
  if (!response.ok || !data.IpfsHash) {
    throw new Error(
      "Pinata metadata upload failed: " + JSON.stringify(data.error ?? data)
    );
  }

  return data.IpfsHash;
}
