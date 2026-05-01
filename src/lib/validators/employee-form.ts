import { z } from "zod";

import { EMPLOYEE_ID_TYPES } from "@/lib/employee-constants";

const idTuple = EMPLOYEE_ID_TYPES as unknown as [string, ...string[]];

const identificationSchema = z.object({
  sid: z.string(),
  idType: z.union([z.literal(""), z.enum(idTuple)]),
  idNumber: z.string().optional(),
  issuingCountry: z.string().optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  isPrimary: z.boolean(),
  notes: z.string().optional(),
});

export const employeeFormSchema = z
  .object({
    fileNumber: z.string().trim().min(1, "File number is required"),
    firstName: z.string().trim().min(1, "First name is required"),
    middleName: z.union([z.literal(""), z.string()]).optional(),
    lastName: z.string().trim().min(1, "Last name is required"),
    preferredName: z.string().optional(),
    gender: z.string().optional(),
    dateOfBirth: z.string().optional(),
    nationality: z.string().optional(),
    maritalStatus: z.string().optional(),
    personalEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
    workEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
    mobileNumber: z.string().optional(),
    homeNumber: z.string().optional(),
    addressLine1: z.string().trim().min(1, "Address line 1 is required"),
    addressLine2: z.string().optional(),
    communityCity: z.string().trim().min(1, "Community / city is required"),
    regionMunicipality: z.string().optional(),
    country: z.string().trim().min(1, "Country is required"),
    postalCode: z.string().optional(),
    mailingSameAsResidential: z.boolean(),
    mailingAddressLine1: z.string().optional(),
    mailingAddressLine2: z.string().optional(),
    mailingCommunityCity: z.string().optional(),
    mailingRegionMunicipality: z.string().optional(),
    mailingCountry: z.string().optional(),
    mailingPostalCode: z.string().optional(),
    emergencyContactName: z.string().trim().min(1, "Contact name is required"),
    emergencyContactRelationship: z.string().trim().min(1, "Relationship is required"),
    emergencyContactMobileNumber: z.string().trim().min(1, "Mobile number is required"),
    emergencyContactAlternativeNumber: z.string().optional(),
    emergencyContactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
    emergencyContactAddress: z.string().optional(),
    secondaryEmergencyContactName: z.string().optional(),
    secondaryEmergencyContactRelationship: z.string().optional(),
    secondaryEmergencyContactMobileNumber: z.string().optional(),
    secondaryEmergencyContactAlternativeNumber: z.string().optional(),
    secondaryEmergencyContactEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
    secondaryEmergencyContactAddress: z.string().optional(),
    nextOfKinFullName: z.string().optional(),
    nextOfKinRelationship: z.string().optional(),
    nextOfKinMobileNumber: z.string().optional(),
    nextOfKinAlternativeNumber: z.string().optional(),
    nextOfKinEmail: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
    nextOfKinAddress: z.string().optional(),
    workPermitRequired: z.boolean(),
    workPermitNumber: z.string().optional(),
    workPermitExpiryDate: z.string().optional(),
    immigrationStatus: z.string().optional(),
    countryOfCitizenship: z.string().optional(),
    rightToWorkConfirmed: z.boolean(),
    department: z.string().optional(),
    position: z.string().optional(),
    employeeCategory: z.string().optional(),
    employmentStatus: z.string().optional(),
    workLocation: z.string().optional(),
    dateFirstEngaged: z.string().optional(),
    photoUrl: z.string().optional(),
    identifications: z.array(identificationSchema),
  })
  .superRefine((data, ctx) => {
    const primaries = data.identifications.filter((i) => i.isPrimary);
    if (primaries.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Only one identification can be marked as primary.",
        path: ["identifications"],
      });
    }

    data.identifications.forEach((identification, index) => {
      const hasType = identification.idType !== "";
      const hasNumber = Boolean(identification.idNumber?.trim());
      if (hasType && !hasNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ID number is required when ID type is selected.",
          path: ["identifications", index, "idNumber"],
        });
      }
      if (!hasType && hasNumber) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ID type is required when ID number is entered.",
          path: ["identifications", index, "idType"],
        });
      }
    });

    if (!data.mailingSameAsResidential) {
      const hasMailingData = [
        data.mailingAddressLine1,
        data.mailingAddressLine2,
        data.mailingCommunityCity,
        data.mailingRegionMunicipality,
        data.mailingCountry,
        data.mailingPostalCode,
      ].some((value) => value?.trim());
      if (hasMailingData) {
        if (!data.mailingAddressLine1?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Mailing address line 1 is required.",
            path: ["mailingAddressLine1"],
          });
        }
        if (!data.mailingCommunityCity?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Mailing community / city is required.",
            path: ["mailingCommunityCity"],
          });
        }
      }
    }

    if (data.workPermitRequired) {
      if (!data.workPermitNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Work permit number is required when work permit is required.",
          path: ["workPermitNumber"],
        });
      }
      if (!data.workPermitExpiryDate?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Work permit expiry date is required when work permit is required.",
          path: ["workPermitExpiryDate"],
        });
      }
    }
  });

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;
