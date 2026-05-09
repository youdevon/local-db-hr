import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type PublicHolidayRow = {
  id: string;
  holidayDate: string;
  name: string;
  countryCode: string;
  active: boolean;
};

/** Active holidays in [startIso, endIso] as YYYY-MM-DD → holiday name */
export async function getPublicHolidayMapForRange(
  startIso: string,
  endIso: string,
  countryCode: string = "TT",
): Promise<Map<string, string>> {
  try {
    const rows = await prisma.$queryRaw<Array<{ holiday_date: Date; name: string }>>(
      Prisma.sql`
        SELECT holiday_date, name
        FROM public.public_holidays
        WHERE country_code = ${countryCode}
          AND active = true
          AND holiday_date >= ${startIso}::date
          AND holiday_date <= ${endIso}::date
        ORDER BY holiday_date ASC
      `,
    );

    const map = new Map<string, string>();
    for (const row of rows) {
      const iso = row.holiday_date.toISOString().slice(0, 10);
      map.set(iso, row.name);
    }
    return map;
  } catch (error) {
    // Missing migration/table or DB error — leave counts still work without TT holidays (weekends excluded only).
    console.warn("[public-holidays] Could not load holidays for range; continuing without public holidays.", error);
    return new Map();
  }
}

export async function getPublicHolidaySetForRange(
  startIso: string,
  endIso: string,
  countryCode: string = "TT",
): Promise<Set<string>> {
  const m = await getPublicHolidayMapForRange(startIso, endIso, countryCode);
  return new Set(m.keys());
}

export async function listPublicHolidaysByYear(year: number, countryCode: string = "TT"): Promise<PublicHolidayRow[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  try {
    const rows = await prisma.$queryRaw<
      Array<{ id: string; holiday_date: Date; name: string; country_code: string; active: boolean }>
    >(
      Prisma.sql`
        SELECT id::text, holiday_date, name, country_code, active
        FROM public.public_holidays
        WHERE country_code = ${countryCode}
          AND holiday_date >= ${start}::date
          AND holiday_date <= ${end}::date
        ORDER BY holiday_date ASC, name ASC
      `,
    );

    return rows.map((r) => ({
      id: r.id,
      holidayDate: r.holiday_date.toISOString().slice(0, 10),
      name: r.name,
      countryCode: r.country_code,
      active: r.active,
    }));
  } catch (error) {
    console.warn("[public-holidays] Could not list holidays by year.", error);
    return [];
  }
}
