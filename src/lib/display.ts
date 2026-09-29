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
