import { endOfDay, formatDuration, intervalToDuration, startOfDay, subDays } from "date-fns";

import { roundDecimal } from "./mathHelpers";

export const averageDaysInMonth = 30.437;

export const epochToDate = (epoch: number) => {
  // The 0 sets the date to the epoch
  const d = new Date(0);
  d.setUTCSeconds(epoch);

  return d;
};

export const getDayStr = (date?: Date) => {
  return date ? toUTC(date).toISOString().split("T")[0] : getTodayUTC().toISOString().split("T")[0];
};

export function getTodayUTC() {
  const currentDate = toUTC(new Date());
  currentDate.setUTCHours(0, 0, 0, 0);

  return currentDate;
}

export function toUTC(date: Date) {
  const now_utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds());

  return new Date(now_utc);
}

export function getPrettyTime(timeMs: number): string {
  if (timeMs < 10) {
    return `${roundDecimal(timeMs, 2)}ms`;
  } else if (timeMs < 1_000) {
    return `${roundDecimal(timeMs, 0)}ms`;
  } else if (timeMs < 60 * 1_000) {
    return `${roundDecimal(timeMs / 1_000, 2)}s`;
  } else if (timeMs < 60 * 60 * 1_000) {
    return `${Math.floor(timeMs / 1_000 / 60)}m ${roundDecimal((timeMs / 1000) % 60, 2)}s`;
  } else {
    return `${Math.floor(timeMs / 1_000 / 60 / 60)}h ${roundDecimal(timeMs / 1_000 / 60, 2) % 60}m`;
  }
}

/**
 * Formats a provider's offered reclamation window (AEP-82) into a human-readable label.
 * The window arrives as a protobuf Duration string from the REST gateway, e.g. "3600s" -> "1 hour".
 * Returns null when absent, non-positive, or malformed so callers render nothing.
 */
export function formatReclamationWindow(window?: string): string | null {
  if (!window) return null;

  const seconds = parseFloat(window);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  // intervalToDuration truncates any leftover < 1s, so a fractional Duration like "60.5s" -> "1 minute".
  const duration = intervalToDuration({ start: 0, end: seconds * 1000 });
  return formatDuration(duration, { format: ["days", "hours", "minutes", "seconds"], delimiter: ", " });
}

export function createDateRange(input: { from?: Date; to?: Date } = {}): { from: Date; to: Date } {
  if (input.from && input.to && input.from > input.to) {
    throw new Error("End date must be greater than or equal to start date.");
  }

  const to = endOfDay(input.to || new Date());
  const from = startOfDay(input.from || subDays(to, 30));

  return {
    from,
    to
  };
}
