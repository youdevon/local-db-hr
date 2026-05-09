import { describe, expect, it } from "vitest";

import { calculateGratuity, contractMonthsBetween, resolveGratuityContractMonths } from "./gratuity-calculation";

describe("contractMonthsBetween", () => {
  it("counts Jan 15 → Feb 14 as 1 month", () => {
    expect(contractMonthsBetween("2026-01-15", "2026-02-14")).toBe(1);
  });

  it("counts Jan 15 → Jan 14 three years later as 36 months", () => {
    expect(contractMonthsBetween("2026-01-15", "2029-01-14")).toBe(36);
  });

  it("does not use day-based fractional months (36 calendar months ≈ 370800 gross)", () => {
    const months = contractMonthsBetween("2026-01-15", "2029-01-14");
    expect(months).toBe(36);
    const { grossContractSalary } = calculateGratuity({
      monthlySalary: 10_300,
      contractMonths: months,
      gratuityRate: 20,
      governmentTaxRate: 25,
    });
    expect(grossContractSalary).toBe(370_800);
  });
});

describe("calculateGratuity", () => {
  it("uses monthly salary × whole months for gross contract salary", () => {
    const { grossContractSalary } = calculateGratuity({
      monthlySalary: 10_300,
      contractMonths: 36,
      gratuityRate: 20,
      governmentTaxRate: 25,
    });
    expect(grossContractSalary).toBe(370_800);
  });
});

describe("resolveGratuityContractMonths", () => {
  it("prefers explicit duration when end date matches that period", () => {
    expect(
      resolveGratuityContractMonths({
        startDate: "2026-01-15",
        endDate: "2029-01-14",
        explicitDurationMonths: 36,
        endDateMatchesExplicitDuration: true,
      }),
    ).toBe(36);
  });

  it("falls back to date-based months when explicit duration does not match end date", () => {
    expect(
      resolveGratuityContractMonths({
        startDate: "2026-01-15",
        endDate: "2029-01-14",
        explicitDurationMonths: 35,
        endDateMatchesExplicitDuration: false,
      }),
    ).toBe(36);
  });
});
