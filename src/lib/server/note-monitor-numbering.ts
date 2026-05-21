import "server-only";

import { Prisma } from "@prisma/client";

import { formatNoteDisplayReference } from "@/lib/note-monitor/constants";
import { prisma } from "@/lib/prisma";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function ensureNoteNumberSequenceRow(tx: TransactionClient, noteYear: number): Promise<void> {
  await tx.$executeRaw(
    Prisma.sql`
      INSERT INTO public.note_number_sequences (note_year, next_number, auto_reset_yearly)
      VALUES (${noteYear}, 1, true)
      ON CONFLICT (note_year) DO NOTHING
    `,
  );
}

export async function getUsedActiveNoteNumbersForYear(
  tx: TransactionClient,
  noteYear: number,
): Promise<Set<number>> {
  const rows = await tx.note_monitor_records.findMany({
    where: { note_year: noteYear, deleted_at: null },
    select: { note_number: true },
  });

  return new Set(rows.map((row) => row.note_number));
}

export async function findLowestAvailableNoteNumber(
  tx: TransactionClient,
  noteYear: number,
): Promise<number | null> {
  const used = await getUsedActiveNoteNumbersForYear(tx, noteYear);
  if (used.size === 0) return null;

  const maxUsed = Math.max(...used);
  for (let candidate = 1; candidate <= maxUsed; candidate += 1) {
    if (!used.has(candidate)) return candidate;
  }

  return null;
}

export async function allocateNextNoteNumber(
  tx: TransactionClient,
  noteYear: number,
): Promise<{ noteNumber: number; displayReference: string; reused: boolean }> {
  const gapNumber = await findLowestAvailableNoteNumber(tx, noteYear);

  if (gapNumber !== null) {
    await ensureNoteNumberSequenceRow(tx, noteYear);

    const rows = await tx.$queryRaw<Array<{ next_number: number }>>(
      Prisma.sql`
        SELECT next_number
        FROM public.note_number_sequences
        WHERE note_year = ${noteYear}
        FOR UPDATE
      `,
    );

    const currentNextNumber = rows[0]?.next_number ?? 1;

    if (gapNumber >= currentNextNumber) {
      await tx.$executeRaw(
        Prisma.sql`
          UPDATE public.note_number_sequences
          SET next_number = ${gapNumber + 1},
              updated_at = NOW()
          WHERE note_year = ${noteYear}
        `,
      );
    }

    return {
      noteNumber: gapNumber,
      displayReference: formatNoteDisplayReference(gapNumber, noteYear),
      reused: true,
    };
  }

  await ensureNoteNumberSequenceRow(tx, noteYear);

  const rows = await tx.$queryRaw<Array<{ next_number: number }>>(
    Prisma.sql`
      SELECT next_number
      FROM public.note_number_sequences
      WHERE note_year = ${noteYear}
      FOR UPDATE
    `,
  );

  const nextNumber = rows[0]?.next_number ?? 1;

  await tx.$executeRaw(
    Prisma.sql`
      UPDATE public.note_number_sequences
      SET next_number = ${nextNumber + 1},
          updated_at = NOW()
      WHERE note_year = ${noteYear}
    `,
  );

  return {
    noteNumber: nextNumber,
    displayReference: formatNoteDisplayReference(nextNumber, noteYear),
    reused: false,
  };
}

export async function listNoteNumberSequenceForYear(noteYear: number) {
  try {
    return await prisma.note_number_sequences.findUnique({
      where: { note_year: noteYear },
      include: {
        updated_by_user: {
          select: {
            profile: { select: { full_name: true } },
            email: true,
          },
        },
      },
    });
  } catch {
    return null;
  }
}

export async function getHighestUsedNoteNumberForYear(noteYear: number): Promise<number> {
  const result = await prisma.note_monitor_records.aggregate({
    where: { note_year: noteYear, deleted_at: null },
    _max: { note_number: true },
  });

  return result._max.note_number ?? 0;
}

export async function setNoteNumberSequenceNextNumber(input: {
  noteYear: number;
  nextNumber: number;
  updatedByUserId: string | null;
}): Promise<{ previousNextNumber: number | null }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw(
      Prisma.sql`
        INSERT INTO public.note_number_sequences (note_year, next_number, auto_reset_yearly, updated_by)
        VALUES (${input.noteYear}, ${input.nextNumber}, true, ${input.updatedByUserId}::uuid)
        ON CONFLICT (note_year) DO NOTHING
      `,
    );

    const existing = await tx.$queryRaw<Array<{ next_number: number }>>(
      Prisma.sql`
        SELECT next_number
        FROM public.note_number_sequences
        WHERE note_year = ${input.noteYear}
        FOR UPDATE
      `,
    );

    const previousNextNumber = existing[0]?.next_number ?? null;

    await tx.$executeRaw(
      Prisma.sql`
        UPDATE public.note_number_sequences
        SET next_number = ${input.nextNumber},
            updated_at = NOW(),
            updated_by = ${input.updatedByUserId}::uuid
        WHERE note_year = ${input.noteYear}
      `,
    );

    return { previousNextNumber };
  });
}
