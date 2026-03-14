export function rangeToHours(range: "24h" | "7d" | "30d" | "90d") {
  if (range === "24h") return 24;
  if (range === "7d") return 24 * 7;
  if (range === "30d") return 24 * 30;
  return 24 * 90;
}

export function clamp(num: number, min: number, max: number) {
  return Math.min(Math.max(num, min), max);
}
