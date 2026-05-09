import { z } from "zod";

const safeText = z
  .string()
  .trim()
  .max(255)
  .refine((value) => !/[<>]/.test(value), "Invalid characters are not allowed.");

const optionalSafeText = z
  .string()
  .trim()
  .max(255)
  .refine((value) => !/[<>]/.test(value), "Invalid characters are not allowed.")
  .optional()
  .or(z.literal(""));

const optionalPhone = z
  .string()
  .trim()
  .max(50)
  .refine((value) => value === "" || !/[<>]/.test(value), "Invalid characters are not allowed.")
  .optional()
  .or(z.literal(""));

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .email("Please enter a valid email address.")
  .optional()
  .or(z.literal(""));

export const updateOwnEmployeePersonalInfoSchema = z.object({
  mobileNumber: optionalPhone,
  homeNumber: optionalPhone,
  personalEmail: optionalEmail,

  addressLine1: safeText,
  addressLine2: optionalSafeText,
  communityCity: safeText,
  regionMunicipality: optionalSafeText,
  country: safeText,
  postalCode: optionalSafeText,

  emergencyContactName: safeText,
  emergencyContactRelationship: safeText,
  emergencyContactMobileNumber: safeText,
  emergencyContactAlternativeNumber: optionalPhone,
  emergencyContactEmail: optionalEmail,
  emergencyContactAddress: optionalSafeText,

  nextOfKinFullName: safeText,
  nextOfKinRelationship: safeText,
  nextOfKinMobileNumber: safeText,
  nextOfKinAlternativeNumber: optionalPhone,
  nextOfKinEmail: optionalEmail,
  nextOfKinAddress: optionalSafeText,
});

export type UpdateOwnEmployeePersonalInfoInput = z.infer<
  typeof updateOwnEmployeePersonalInfoSchema
>;
