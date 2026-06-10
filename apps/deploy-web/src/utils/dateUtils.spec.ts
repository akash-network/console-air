import { describe, expect, it } from "vitest";

import { formatReclamationWindow } from "./dateUtils";

describe("formatReclamationWindow", () => {
  it("formats a whole-hour window", () => {
    expect(formatReclamationWindow("3600s")).toBe("1 hour");
  });

  it("formats a multi-unit window", () => {
    // 1 day, 2 hours, 3 minutes, 4 seconds
    expect(formatReclamationWindow("93784s")).toBe("1 day, 2 hours, 3 minutes, 4 seconds");
  });

  it("ignores sub-second precision in the Duration string", () => {
    expect(formatReclamationWindow("60.500000001s")).toBe("1 minute");
  });

  it.each(["", "0s", "-30s", "abc", undefined])("returns null for non-positive or malformed input: %s", input => {
    expect(formatReclamationWindow(input)).toBeNull();
  });
});
