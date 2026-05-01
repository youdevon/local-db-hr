import { z } from "zod";

import { APP_USER_ROLES } from "@/lib/app-user-roles";

export const createUserFormSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
    role: z.enum(APP_USER_ROLES),
    department: z.string().optional(),
    isActive: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

export type CreateUserFormInput = z.infer<typeof createUserFormSchema>;

export const updateUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(APP_USER_ROLES),
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
