const DISPLAY_TIME_ZONE = process.env.NEXT_PUBLIC_DISPLAY_TIMEZONE ?? "America/Detroit";

export function formatLocalTimestamp(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE
  }).format(date);
}

// Kept for compatibility with existing imports; now uses local display formatting.
export const formatUtcTimestamp = formatLocalTimestamp;
