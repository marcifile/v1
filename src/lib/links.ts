export function normalizeOptionalHttpUrl(
  input: unknown,
  label: string,
  maxLength = 240
) {
  const raw = String(input || "").trim();
  if (!raw) return null;

  const candidate = /^https?:\/\//i.test(raw) ? raw : "https://" + raw;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(label + " is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(label + " must use http or https.");
  }

  const normalized = url.toString();
  if (normalized.length > maxLength) {
    throw new Error(label + " is too long.");
  }

  return normalized;
}
