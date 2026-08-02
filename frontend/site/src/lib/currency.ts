/** Nepali Rupee (NPR) formatting — always "Rs", never Indian ₹. */
export function formatNpr(amount: number): string {
  const value = Number.isFinite(amount) ? amount : 0;
  return `Rs ${value.toLocaleString("en-NP")}`;
}

/** @deprecated Use formatNpr — kept as alias for existing imports */
export const inr = formatNpr;
