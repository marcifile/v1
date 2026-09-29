export function formatBaseUnits(
  raw: string | number | bigint,
  decimals: number,
  maxFraction = 4
) {
  const source = String(raw);
  if (!/^\d+$/.test(source)) return "0";

  const padded = source.padStart(decimals + 1, "0");
  const whole = decimals === 0 ? padded : padded.slice(0, -decimals) || "0";
  const fraction =
    decimals === 0
      ? ""
      : padded
          .slice(-decimals)
          .slice(0, maxFraction)
          .replace(/0+$/, "");

  return fraction
    ? Number(whole).toLocaleString() + "." + fraction
    : Number(whole).toLocaleString();
}

export function shortAddress(value: string, size = 5) {
  if (!value) return "—";
  return value.slice(0, size) + "…" + value.slice(-size);
}

export function mediaUrl(value: string | null | undefined) {
  if (!value) return "/pond-mark.svg";
  if (value.startsWith("ipfs://")) {
    return "https://gateway.pinata.cloud/ipfs/" + value.slice("ipfs://".length);
  }
  return value;
}

export function solanaExplorerUrl(
  kind: "address" | "tx",
  value: string
) {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
  const base = "https://explorer.solana.com/" + kind + "/" + value;
  return cluster === "mainnet" || cluster === "mainnet-beta"
    ? base
    : base + "?cluster=" + encodeURIComponent(cluster);
}
