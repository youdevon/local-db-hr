import { describe, expect, it } from "vitest";

import {
  calculateWorkingLeaveDays,
  calculateCalendarInclusiveLeaveDays,
  calculateLeaveDays,
} from "./leave-days";

const H = (dates: string[]) => new Set(dates);

describe("calculateWorkingLeaveDays", () => {
  it("counts Monday–Friday as 5", () => {
    expect(calculateWorkingLeaveDays("2026-06-01", "2026-06-05", new Set())).toBe(5);
  });

  it("counts Monday–Sunday as 5 working days", () => {
    expect(calculateWorkingLeaveDays("2026-06-01", "2026-06-07", new Set())).toBe(5);
  });

  it("counts two full calendar weeks as 10 working days", () => {
    expect(calculateWorkingLeaveDays("2026-06-01", "2026-06-14", new Set())).toBe(10);
  });

  it("returns 0 for Saturday–Sunday only", () => {
    expect(calculateWorkingLeaveDays("2026-06-06", "2026-06-07", new Set())).toBe(0);
  });

  it("counts Friday–Monday as 2 working days", () => {
    expect(calculateWorkingLeaveDays("2026-06-05", "2026-06-08", new Set())).toBe(2);
  });

  it("excludes a weekday public holiday", () => {
    expect(calculateWorkingLeaveDays("2026-06-01", "2026-06-05", H(["2026-06-03"]))).toBe(4);
  });

  it("does not double-count holiday on weekend", () => {
    expect(calculateWorkingLeaveDays("2026-06-06", "2026-06-07", H(["2026-06-06"]))).toBe(0);
  });

  it("returns 0 for invalid range", () => {
    expect(calculateWorkingLeaveDays("2026-06-10", "2026-06-01", new Set())).toBe(0);
  });
});

describe("calculateLeaveDays manual override", () => {
  it("preserves manual value when provided", () => {
    const r = calculateLeaveDays({
      startDate: "2026-06-05",
      endDate: "2026-06-08",
      holidayDates: new Set(),
      manualLeaveDays: 4,
    });
    expect(r.autoCalculatedDays).toBe(2);
    expect(r.finalDays).toBe(4);
    expect(r.usedManualOverride).toBe(true);
  });
});

describe("calendar inclusive legacy", () => {
  it("matches natural day span", () => {
    expect(calculateCalendarInclusiveLeaveDays("2026-06-01", "2026-06-07")).toBe(7);
  });
});
