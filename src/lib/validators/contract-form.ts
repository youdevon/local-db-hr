import { z } from "zod";

import {
  ALLOWANCE_FREQUENCY_OPTIONS,
  ALLOWANCE_TYPE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
} from "@/lib/mock/contracts";
import { contractEndDateMatchesPeriod } from "@/lib/contract-dates";

const allowanceTypeTuple = ALLOWANCE_TYPE_OPTIONS as unknown as [string, ...string[]];
const allowanceFrequencyTuple = ALLOWANCE_FREQUENCY_OPTIONS as unknown as [string, ...string[]];
const contractStatusTuple = CONTRACT_STATUS_OPTIONS as unknown as [string, ...string[]];

const allowanceSchema = z.object({
  aid: z.string(),
  allowanceType: z.union([z.literal(""), z.enum(allowanceTypeTuple)]),
  description: z.string().optional(),
  amount: z.union([z.literal(""), z.coerce.number().min(0, "Amount must be greater than or equal to 0")]),
  frequency: z.union([z.literal(""), z.enum(allowanceFrequencyTuple)]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  taxable: z.boolean(),
  notes: z.string().optional(),
});

export const contractFormSchema = z
  .object({
    employeeId: z.string().trim().min(1, "Employee is required"),
    minuteNumber: z.string().optional(),
    noAssignedContractNumber: z.boolean(),
    contractNumber: z.string().optional(),
    durationPreset: z.union([z.literal(""), z.enum(["3", "6", "12", "24", "custom"])]),
    customDurationMonths: z.union([z.literal(""), z.coerce.number().min(1, "Custom duration must be 1 month or more")]),
    manualEndDateOverride: z.boolean(),
    startDate: z.string().trim().min(1, "Start date is required"),
    endDate: z.string().trim().min(1, "End date is required"),
    dateReceived: z.string().optional(),
    dateSigned: z.string().optional(),
    status: z.enum(contractStatusTuple),
    notes: z.string().optional(),
    retirementOverrideReason: z.string().optional(),
    retirementOverrideApprovalReference: z.string().optional(),
    retirementOverrideConfirmed: z.boolean().optional(),
    allowancesChanged: z.boolean().optional(),
    salary: z.coerce.number().min(0, "Salary must be greater than or equal to 0"),
    gratuity: z.union([z.literal(""), z.coerce.number().min(0, "Gratuity must be greater than or equal to 0")]),
    vacationLeaveEntitlement: z.coerce.number().min(0, "Vacation leave entitlement must be 0 or more"),
    sickLeaveEntitlement: z.coerce.number().min(0, "Sick leave entitlement must be 0 or more"),
    vacationRolloverAllowed: z.boolean(),
    sickRolloverAllowed: z.boolean(),
    allowances: z.array(allowanceSchema),
  })
  .superRefine((data, ctx) => {
    if (!data.noAssignedContractNumber && !data.contractNumber?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Contract number is required.",
        path: ["contractNumber"],
      });
    }
    if (!data.manualEndDateOverride) {
      if (data.durationPreset === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contract duration is required unless end date is manually entered.",
          path: ["durationPreset"],
        });
      }
      const durationMonths =
        data.durationPreset === "custom"
          ? data.customDurationMonths === ""
            ? 0
            : Number(data.customDurationMonths)
          : data.durationPreset === ""
            ? 0
            : Number(data.durationPreset);
      if (durationMonths <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contract duration is required unless end date is manually entered.",
          path: ["durationPreset"],
        });
      } else if (!contractEndDateMatchesPeriod(data.startDate, data.endDate, durationMonths)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Contract end date must follow the selected contract period.",
          path: ["endDate"],
        });
      }
    }
    if (data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Contract end date must be after the start date.",
        path: ["endDate"],
      });
    }
    if (data.dateReceived && data.dateSigned && data.dateSigned < data.dateReceived) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Date employee signed contract cannot be before date employee received contract.",
        path: ["dateSigned"],
      });
    }

    data.allowances.forEach((allowance, index) => {
      const hasType = allowance.allowanceType !== "";
      const hasAmount = allowance.amount !== "";
      if (hasType && !hasAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Amount is required when allowance type is selected.",
          path: ["allowances", index, "amount"],
        });
      }
      if (!hasType && hasAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Allowance type is required when amount is entered.",
          path: ["allowances", index, "allowanceType"],
        });
      }
      if (allowance.allowanceType === "Other" && !allowance.description?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Description is required for allowance type Other.",
          path: ["allowances", index, "description"],
        });
      }
      if (allowance.startDate && allowance.endDate && allowance.endDate < allowance.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Allowance end date cannot be before start date.",
          path: ["allowances", index, "endDate"],
        });
      }
      if (allowance.startDate && allowance.startDate < data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Allowance start date should be within the contract period.",
          path: ["allowances", index, "startDate"],
        });
      }
      if (allowance.endDate && allowance.endDate > data.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Allowance end date should be within the contract period.",
          path: ["allowances", index, "endDate"],
        });
      }
    });
  });

export type ContractFormValues = z.input<typeof contractFormSchema>;
export type ContractFormSubmitValues = z.output<typeof contractFormSchema>;
