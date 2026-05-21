import { z } from "zod";

import { NOTE_STATUS_VALUES, NOTE_TYPE_VALUES } from "@/lib/note-monitor/constants";

const noteTypeTuple = NOTE_TYPE_VALUES as unknown as [string, ...string[]];
const noteStatusTuple = NOTE_STATUS_VALUES as unknown as [string, ...string[]];

export const noteMonitorFormSchema = z.object({
  noteType: z.enum(noteTypeTuple, { message: "Note type is required." }),
  notePreparationDate: z.string().trim().min(1, "Note preparation date is required."),
  details: z.string().trim().min(1, "Details are required."),
  dateReturnedFromSecretary: z.string().optional(),
  dateSentToExecutiveCouncil: z.string().optional(),
  dateReceivedFromExecutiveCouncil: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.enum(noteStatusTuple, { message: "Status is required." }),
});

export type NoteMonitorFormValues = z.infer<typeof noteMonitorFormSchema>;

export const noteNumberSequenceUpdateSchema = z.object({
  noteYear: z.coerce.number().int().min(2000).max(2100),
  nextNumber: z.coerce.number().int().min(1, "Next number must be at least 1."),
});

export type NoteNumberSequenceUpdateValues = z.infer<typeof noteNumberSequenceUpdateSchema>;
