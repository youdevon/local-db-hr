/**
 * Generate approximate Trinidad and Tobago public holidays for a calendar year.
 * Movable feasts use Western Easter; admins should verify against official gazettes (especially Divali / Eid).
 */

import { formatLocalIsoDate } from "@/lib/leave-days";

function easterSundayGregorian(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

export type GeneratedHoliday = { date: string; name: string };

/**
 * Standard template for TT — verify against official sources for production use.
 */
export function generateTrinidadTobagoHolidaysForYear(year: number): GeneratedHoliday[] {
  const easter = easterSundayGregorian(year);
  const goodFriday = addDays(easter, -2);
  const easterMonday = addDays(easter, 1);
  const carnivalMonday = addDays(easter, -48);
  const carnivalTuesday = addDays(easter, -47);
  const corpusChristi = addDays(easter, 60);

  const firstMondayJune = (): Date => {
    const d = new Date(year, 5, 1);
    while (d.getDay() !== 1) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  };

  const fixed: GeneratedHoliday[] = [
    { date: `${year}-01-01`, name: "New Year's Day" },
    { date: formatLocalIsoDate(firstMondayJune()), name: "Indian Arrival Day" },
    { date: `${year}-06-19`, name: "Labour Day" },
    { date: `${year}-08-01`, name: "Emancipation Day" },
    { date: `${year}-08-31`, name: "Independence Day" },
    { date: `${year}-09-24`, name: "Republic Day" },
    { date: `${year}-12-25`, name: "Christmas Day" },
    { date: `${year}-12-26`, name: "Boxing Day" },
  ];

  const movable: GeneratedHoliday[] = [
    { date: formatLocalIsoDate(carnivalMonday), name: "Carnival Monday" },
    { date: formatLocalIsoDate(carnivalTuesday), name: "Carnival Tuesday" },
    { date: formatLocalIsoDate(goodFriday), name: "Good Friday" },
    { date: formatLocalIsoDate(easterMonday), name: "Easter Monday" },
    { date: formatLocalIsoDate(corpusChristi), name: "Corpus Christi" },
  ];

  return [...movable, ...fixed].sort((a, b) => a.date.localeCompare(b.date));
}
