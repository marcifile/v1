import BN from "bn.js";

export function humanToBaseUnits(value: string, decimals: number): BN {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Amount must be a positive decimal number.");
  }

  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new Error("Amount has too many decimal places.");
  }

  const paddedFraction = fraction.padEnd(decimals, "0");
  const combined = (whole + paddedFraction).replace(/^0+(?=\d)/, "");
  return new BN(combined || "0");
}

export function baseUnitsToHuman(value: BN, decimals: number): string {
  const raw = value.toString(10).padStart(decimals + 1, "0");
  if (decimals === 0) return raw;
  const whole = raw.slice(0, -decimals) || "0";
  const fraction = raw.slice(-decimals).replace(/0+$/, "");
  return fraction ? whole + "." + fraction : whole;
}
