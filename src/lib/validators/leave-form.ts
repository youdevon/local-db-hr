import { z } from "zod";

import { LEAVE_TYPE_OPTIONS } from "@/lib/leave";

const leaveTypes = LEAVE_TYPE_OPTIONS.map((item) => item.value) as [string, ...string[]];

export const leaveFormSchema = z
  .object({
    employeeId: z.string().min(1),
    contractId: z.string().optional(),
    leaveType: z.enum(leaveTypes, { message: "Please select a leave type." }),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    returnToWorkDate: z.string().min(1),
    leaveDays: z.coerce.number().int().min(1).max(999),
    /** Optional — logged when leave days differ from auto-calculated working days */
    leaveDaysAdjustmentReason: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const startDate = new Date(`${value.startDate}T00:00:00`);
    const endDate = new Date(`${value.endDate}T00:00:00`);
    const returnDate = new Date(`${value.returnToWorkDate}T00:00:00`);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return;
    if (endDate < startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Leave end date must be on or after the start date.",
        path: ["endDate"],
      });
    }
    if (!Number.isNaN(returnDate.getTime()) && returnDate <= endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Return to work date must be after the leave end date.",
        path: ["returnToWorkDate"],
      });
    }
  });

export type LeaveFormValues = z.infer<typeof leaveFormSchema>;

const leaveStatuses = ["recorded", "approved", "cancelled", "rejected", "adjusted"] as const;

export const leaveTransactionEditSchema = leaveFormSchema.extend({
  id: z.string().min(1),
  status: z.enum(leaveStatuses, { message: "Please select a status." }),
});

export type LeaveTransactionEditValues = z.infer<typeof leaveTransactionEditSchema>;
