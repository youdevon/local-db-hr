export type ContractYearRange = {
  yearNumber: number;
  startDate: string;
  endDate: string;
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseIsoDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

function addYearsSafe(source: Date, years: number): Date {
  const year = source.getFullYear() + years;
  const month = source.getMonth();
  const day = source.getDate();
  const candidate = new Date(Date.UTC(year, month, day));
  if (candidate.getUTCMonth() !== month) {
    return new Date(Date.UTC(year, month + 1, 0));
  }
  return candidate;
}

function minusOneDay(date: Date): Date {
  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() - 1);
  return clone;
}

export function generateContractYears(contractStartDate: string, contractEndDate: string): ContractYearRange[] {
  const start = parseIsoDate(contractStartDate);
  const end = parseIsoDate(contractEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];

  const result: ContractYearRange[] = [];
  let year = 1;

  while (true) {
    const yearStart = addYearsSafe(start, year - 1);
    if (yearStart > end) break;

    const nextAnniversary = addYearsSafe(start, year);
    const yearEnd = minDate(minusOneDay(nextAnniversary), end);

    result.push({
      yearNumber: year,
      startDate: toIsoDate(yearStart),
      endDate: toIsoDate(yearEnd),
    });

    if (yearEnd.getTime() >= end.getTime()) break;
    year += 1;
  }

  if (result.length === 0) {
    return [{ yearNumber: 1, startDate: toIsoDate(start), endDate: toIsoDate(end) }];
  }
  return result;
}
