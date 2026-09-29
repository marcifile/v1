import type { NextApiRequest } from "next";

type Bucket = { count: number; resetAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __pondRateLimit: Map<string, Bucket> | undefined;
}

function store() {
  if (!global.__pondRateLimit) global.__pondRateLimit = new Map();
  return global.__pondRateLimit;
}

function clientIp(req: NextApiRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded)) return forwarded[0] || "unknown";
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

export function consumeRateLimit(
  req: NextApiRequest,
  scope: string,
  limit: number,
  windowMs: number
) {
  const now = Date.now();
  const key = scope + ":" + clientIp(req);
  const buckets = store();

  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
  }

  bucket.count += 1;
  buckets.set(key, bucket);

  if (buckets.size > 5000) {
    for (const [entryKey, entry] of buckets) {
      if (entry.resetAt <= now) buckets.delete(entryKey);
    }
  }

  return {
    ok: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
