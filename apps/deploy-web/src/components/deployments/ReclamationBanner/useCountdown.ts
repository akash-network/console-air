"use client";
import { useEffect, useState } from "react";
import formatDuration from "date-fns/formatDuration";
import intervalToDuration from "date-fns/intervalToDuration";

/** Live, second-by-second remaining time to a deadline. Returns null when no deadline or already passed. */
export function useCountdown(deadline: Date | null): string | null {
  const [now, setNow] = useState(() => new Date());
  const deadlineTime = deadline?.getTime();

  useEffect(() => {
    // Tick only while the deadline is in the future; once it passes, render once more and stop —
    // otherwise the interval keeps re-rendering the banner every second with identical output.
    if (deadlineTime === undefined || Date.now() >= deadlineTime) return;
    const interval = setInterval(() => {
      const current = new Date();
      setNow(current);
      if (current.getTime() >= deadlineTime) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineTime]);

  if (deadlineTime === undefined || now.getTime() >= deadlineTime) return null;

  const duration = intervalToDuration({ start: now, end: new Date(deadlineTime) });
  return formatDuration(duration, { format: ["days", "hours", "minutes", "seconds"], delimiter: ", " });
}
