"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import { generateTrinidadTobagoHolidaysForYear } from "@/lib/tt-holidays-generate";
import { prisma } from "@/lib/prisma";

export type PublicHolidaySaveInput = {
  id?: string;
  holidayDate: string;
  name: string;
  countryCode?: string;
  active?: boolean;
};

export type ActionResult = { success: true; message: string } | { success: false; message: string };

async function actor() {
  const session = await getSession();
  const user = session.user;
  return {
    actorUserId: user?.userId ?? null,
    actorEmail: user?.email ?? null,
    actorName: user?.name ?? null,
  };
}

export async function savePublicHolidayAction(input: PublicHolidaySaveInput): Promise<ActionResult> {
  const auth = await requirePermission("settings.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const date = input.holidayDate?.trim();
  const name = input.name?.trim();
  const country = (input.countryCode ?? "TT").trim() || "TT";
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, message: "Enter a valid holiday date." };
  }
  if (!name) return { success: false, message: "Holiday name is required." };

  const a = await actor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    if (input.id?.trim()) {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE public.public_holidays
          SET holiday_date = ${date}::date,
              name = ${name},
              country_code = ${country},
              active = ${input.active ?? true},
              updated_at = NOW()
          WHERE id::text = ${input.id.trim()}
        `,
      );
      await createSystemAuditLog({
        ...a,
        module: "Global Settings",
        action: "updated_public_holiday",
        targetType: "settings",
        targetLabel: "Settings: Public Holidays",
        success: true,
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
        metadata: { holidayDate: date, name, countryCode: country },
      });
    } else {
      await prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO public.public_holidays (holiday_date, name, country_code, active)
          VALUES (${date}::date, ${name}, ${country}, ${input.active ?? true})
          ON CONFLICT (holiday_date, country_code, name)
          DO UPDATE SET active = EXCLUDED.active, updated_at = NOW()
        `,
      );
      await createSystemAuditLog({
        ...a,
        module: "Global Settings",
        action: "created_public_holiday",
        targetType: "settings",
        targetLabel: "Settings: Public Holidays",
        success: true,
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
        metadata: { holidayDate: date, name, countryCode: country },
      });
    }

    revalidatePath("/settings/public-holidays");
    revalidatePath("/settings");
    return { success: true, message: "Holiday saved." };
  } catch {
    return { success: false, message: "Could not save holiday." };
  }
}

export async function deletePublicHolidayAction(id: string): Promise<ActionResult> {
  const auth = await requirePermission("settings.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const a = await actor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    await prisma.$executeRaw(Prisma.sql`DELETE FROM public.public_holidays WHERE id::text = ${id.trim()}`);
    await createSystemAuditLog({
      ...a,
      module: "Global Settings",
      action: "deleted_public_holiday",
      targetType: "settings",
      targetLabel: "Settings: Public Holidays",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: { id },
    });
    revalidatePath("/settings/public-holidays");
    return { success: true, message: "Holiday removed." };
  } catch {
    return { success: false, message: "Could not delete holiday." };
  }
}

export async function generateTtHolidaysForYearAction(year: number): Promise<ActionResult> {
  const auth = await requirePermission("settings.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { success: false, message: "Enter a valid year." };
  }

  const holidays = generateTrinidadTobagoHolidaysForYear(year);
  const a = await actor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    let inserted = 0;
    for (const h of holidays) {
      await prisma.$executeRaw(
        Prisma.sql`
          INSERT INTO public.public_holidays (holiday_date, name, country_code, active)
          VALUES (${h.date}::date, ${h.name}, 'TT', true)
          ON CONFLICT (holiday_date, country_code, name)
          DO UPDATE SET active = true, updated_at = NOW()
        `,
      );
      inserted += 1;
    }

    await createSystemAuditLog({
      ...a,
      module: "Global Settings",
      action: "generated_tt_holidays_year",
      targetType: "settings",
      targetLabel: "Settings: Public Holidays",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: { year, rows: inserted },
    });

    revalidatePath("/settings/public-holidays");
    return {
      success: true,
      message: `Generated ${inserted} holiday rows for ${year}. Verify dates against official notices (especially Divali and Eid).`,
    };
  } catch {
    return { success: false, message: "Could not generate holidays." };
  }
}
