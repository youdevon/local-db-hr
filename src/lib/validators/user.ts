import { z } from "zod";

import { APP_USER_ROLES } from "@/lib/app-user-roles";

/** UI / legacy spellings → canonical DB role (lowercase). */
export function normalizeSubmittedAppRole(value: string): string {
  const t = value.trim().toLowerCase();
  if (t === "contributer") return "contributor";
  return t;
}

const roleFieldSchema = z
  .string()
  .transform((s) => normalizeSubmittedAppRole(s))
  .pipe(
    z.enum(APP_USER_ROLES, {
      message: "Please select a valid user role.",
    }),
  );

export const createUserFormSchema = z
  .object({
    fullName: z.string().trim().min(1, "Please complete all required fields."),
    email: z
      .string()
      .trim()
      .min(1, "Please complete all required fields.")
      .transform((e) => e.toLowerCase())
      .pipe(z.string().email("Enter a valid email")),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please complete all required fields."),
    role: roleFieldSchema,
    department: z.string().optional(),
    isActive: z.boolean(),
    employeeId: z
      .string()
      .optional()
      .transform((s) => {
        const t = (s ?? "").trim();
        return t.length ? t : undefined;
      })
      .refine((s) => !s || z.string().uuid().safeParse(s).success, {
        message: "Please select a valid employee to link, or leave unlinked.",
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

/** Parsed payload sent to createUserAction (normalized email, role, etc.). */
export type CreateUserFormInput = z.output<typeof createUserFormSchema>;
/** Raw react-hook-form values before Zod transforms. */
export type CreateUserFormFieldValues = z.input<typeof createUserFormSchema>;

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: roleFieldSchema,
  confirmationAccepted: z.boolean().optional(),
  reason: z.string().trim().max(500).optional(),
});

export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export const changeOwnPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters."),
    confirmNewPassword: z.string().min(1, "Confirm New Password is required."),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match.",
    path: ["confirmNewPassword"],
  });

export type ChangeOwnPasswordInput = z.infer<typeof changeOwnPasswordSchema>;
