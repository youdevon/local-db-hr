"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { assertViewerCannotMutateOrThrow, getSessionUserId, requirePermission } from "@/lib/auth-server";
import { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { employeeFormSchema, type EmployeeFormValues } from "@/lib/validators/employee-form";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export type CreateEmployeeResult =
  | { success: true; message: "Employee created successfully."; employeeId: string }
  | { success: false; message: string };

export type UpdateEmployeeResult =
  | { success: true; message: "Employee updated successfully." }
  | { success: false; message: string };

function hasAnyValue(values: Array<string | undefined>): boolean {
  return values.some((value) => Boolean(value?.trim()));
}

async function replaceEmployeeChildRecords(tx: TransactionClient, employeeId: string, data: EmployeeFormValues) {
  const mailingHasValues = hasAnyValue([
    data.mailingAddressLine1,
    data.mailingAddressLine2,
    data.mailingCommunityCity,
    data.mailingRegionMunicipality,
    data.mailingCountry,
    data.mailingPostalCode,
  ]);

  await tx.employee_addresses.deleteMany({ where: { employee_id: employeeId } });
  await tx.employee_emergency_contacts.deleteMany({ where: { employee_id: employeeId } });
  await tx.employee_identifications.deleteMany({ where: { employee_id: employeeId } });

  await tx.employee_addresses.create({
    data: {
      employee_id: employeeId,
      address_type: "residential",
      address_line_1: data.addressLine1.trim(),
      address_line_2: data.addressLine2?.trim() || null,
      community_city: data.communityCity.trim(),
      region_municipality: data.regionMunicipality?.trim() || null,
      country: data.country.trim(),
      postal_code: data.postalCode?.trim() || null,
      same_as_residential: false,
      is_primary: true,
    },
  });

  if (!data.mailingSameAsResidential && mailingHasValues) {
    await tx.employee_addresses.create({
      data: {
        employee_id: employeeId,
        address_type: "mailing",
        address_line_1: data.mailingAddressLine1?.trim() || "",
        address_line_2: data.mailingAddressLine2?.trim() || null,
        community_city: data.mailingCommunityCity?.trim() || "",
        region_municipality: data.mailingRegionMunicipality?.trim() || null,
        country: data.mailingCountry?.trim() || "Trinidad and Tobago",
        postal_code: data.mailingPostalCode?.trim() || null,
        same_as_residential: false,
        is_primary: false,
      },
    });
  }

  await tx.employee_emergency_contacts.create({
    data: {
      employee_id: employeeId,
      contact_type: "primary_emergency",
      contact_name: data.emergencyContactName.trim(),
      relationship: data.emergencyContactRelationship.trim(),
      mobile_number: data.emergencyContactMobileNumber.trim(),
      alternative_number: data.emergencyContactAlternativeNumber?.trim() || null,
      email: data.emergencyContactEmail?.trim() || null,
      address: data.emergencyContactAddress?.trim() || null,
      is_primary: true,
    },
  });

  if (
    hasAnyValue([
      data.secondaryEmergencyContactName,
      data.secondaryEmergencyContactRelationship,
      data.secondaryEmergencyContactMobileNumber,
      data.secondaryEmergencyContactAlternativeNumber,
      data.secondaryEmergencyContactEmail,
      data.secondaryEmergencyContactAddress,
    ])
  ) {
    await tx.employee_emergency_contacts.create({
      data: {
        employee_id: employeeId,
        contact_type: "secondary_emergency",
        contact_name: data.secondaryEmergencyContactName?.trim() || "",
        relationship: data.secondaryEmergencyContactRelationship?.trim() || "",
        mobile_number: data.secondaryEmergencyContactMobileNumber?.trim() || "",
        alternative_number: data.secondaryEmergencyContactAlternativeNumber?.trim() || null,
        email: data.secondaryEmergencyContactEmail?.trim() || null,
        address: data.secondaryEmergencyContactAddress?.trim() || null,
        is_primary: false,
      },
    });
  }

  if (
    hasAnyValue([
      data.nextOfKinFullName,
      data.nextOfKinRelationship,
      data.nextOfKinMobileNumber,
      data.nextOfKinAlternativeNumber,
      data.nextOfKinEmail,
      data.nextOfKinAddress,
    ])
  ) {
    await tx.employee_emergency_contacts.create({
      data: {
        employee_id: employeeId,
        contact_type: "next_of_kin",
        contact_name: data.nextOfKinFullName?.trim() || "",
        relationship: data.nextOfKinRelationship?.trim() || "",
        mobile_number: data.nextOfKinMobileNumber?.trim() || "",
        alternative_number: data.nextOfKinAlternativeNumber?.trim() || null,
        email: data.nextOfKinEmail?.trim() || null,
        address: data.nextOfKinAddress?.trim() || null,
        is_primary: false,
      },
    });
  }

  const identifications = data.identifications.filter((item) => item.idType.trim() !== "" && item.idNumber?.trim());
  if (identifications.length > 0) {
    await tx.employee_identifications.createMany({
      data: identifications.map((item) => ({
        employee_id: employeeId,
        id_type: item.idType,
        id_number: item.idNumber?.trim() || "",
        issuing_country: item.issuingCountry?.trim() || "Trinidad and Tobago",
        issue_date: item.issueDate?.trim() ? new Date(`${item.issueDate}T12:00:00`) : null,
        expiry_date: item.expiryDate?.trim() ? new Date(`${item.expiryDate}T12:00:00`) : null,
        is_primary: item.isPrimary,
        notes: item.notes?.trim() || null,
      })),
    });
  }

  await tx.employee_right_to_work.upsert({
    where: { employee_id: employeeId },
    create: {
      employee_id: employeeId,
      work_permit_required: data.workPermitRequired,
      work_permit_number: data.workPermitNumber?.trim() || null,
      work_permit_expiry_date: data.workPermitExpiryDate?.trim()
        ? new Date(`${data.workPermitExpiryDate}T12:00:00`)
        : null,
      immigration_status: data.immigrationStatus?.trim() || null,
      country_of_citizenship: data.countryOfCitizenship?.trim() || "Trinidad and Tobago",
      right_to_work_confirmed: data.rightToWorkConfirmed,
    },
    update: {
      work_permit_required: data.workPermitRequired,
      work_permit_number: data.workPermitNumber?.trim() || null,
      work_permit_expiry_date: data.workPermitExpiryDate?.trim()
        ? new Date(`${data.workPermitExpiryDate}T12:00:00`)
        : null,
      immigration_status: data.immigrationStatus?.trim() || null,
      country_of_citizenship: data.countryOfCitizenship?.trim() || "Trinidad and Tobago",
      right_to_work_confirmed: data.rightToWorkConfirmed,
      updated_at: new Date(),
    },
  });
}

export async function createEmployeeAction(input: unknown): Promise<CreateEmployeeResult> {
  await assertViewerCannotMutateOrThrow();
  const access = await requirePermission("employees.create");
  if (!access) {
    return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  }
  const actorUserId = await getSessionUserId();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const parsed = employeeFormSchema.safeParse(input);
  if (!parsed.success) {
    await createSystemAuditLog({
      actorUserId,
      module: "Employees",
      action: "created_employee",
      targetType: "employee",
      success: false,
      failureReason: "Please complete all required fields.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Please complete all required fields." };
  }

  const data = parsed.data;
  const attemptedLabel = `Employee: ${data.firstName.trim()} ${data.lastName.trim()}`.trim();
  try {
    const employeeId = await prisma.$transaction(async (tx) => {
      const employee = await tx.employees.create({
        data: {
          file_number: data.fileNumber.trim(),
          first_name: data.firstName.trim(),
          middle_name: data.middleName?.trim() || null,
          last_name: data.lastName.trim(),
          preferred_name: data.preferredName?.trim() || null,
          gender: data.gender?.trim() || null,
          date_of_birth: data.dateOfBirth?.trim() ? new Date(`${data.dateOfBirth}T12:00:00`) : null,
          nationality: data.nationality?.trim() || null,
          marital_status: data.maritalStatus?.trim() || null,
          personal_email: data.personalEmail?.trim() || null,
          work_email: data.workEmail?.trim() || null,
          mobile_number: data.mobileNumber?.trim() || null,
          home_number: data.homeNumber?.trim() || null,
          photo_url: data.photoUrl?.trim() || null,
        },
      });

      await replaceEmployeeChildRecords(tx, employee.id, data);
      return employee.id;
    });

    if (process.env.NODE_ENV === "development") console.info("Created employee id:", employeeId);

    revalidatePath("/employees");
    revalidatePath("/employees/directory");
    revalidatePath("/employees/age-monitoring");
    revalidatePath("/");
    await createSystemAuditLog({
      actorUserId,
      module: "Employees",
      action: "created_employee",
      targetType: "employee",
      targetId: employeeId,
      targetLabel: attemptedLabel,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: true, message: "Employee created successfully.", employeeId };
  } catch (error) {
    let failureMessage = "Failed to create employee. Please try again.";
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(",") : String(error.meta?.target ?? "");
      const normalized = target.toLowerCase();
      if (normalized.includes("file_number")) {
        failureMessage = "File number already exists. Please use a unique file number.";
      } else if (normalized.includes("identification") || normalized.includes("id_number") || normalized.includes("normalized_id_number")) {
        failureMessage = "Identification number already exists. Please check the ID details.";
      } else {
        failureMessage = "A record with the same unique value already exists.";
      }
    }
    await createSystemAuditLog({
      actorUserId,
      module: "Employees",
      action: "created_employee",
      targetType: "employee",
      targetLabel: attemptedLabel,
      success: false,
      failureReason: failureMessage,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      console.error("[employees:create] failed", error);
    }
    return { success: false, message: failureMessage };
  }
}

export async function updateEmployeeAction(employeeId: string, input: unknown): Promise<UpdateEmployeeResult> {
  await assertViewerCannotMutateOrThrow();
  const access = await requirePermission("employees.edit");
  if (!access) {
    return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  }

  const actorUserId = await getSessionUserId();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const parsed = employeeFormSchema.safeParse(input);
  if (!parsed.success) {
    await createSystemAuditLog({
      actorUserId,
      module: "Employees",
      action: "edited_employee",
      targetType: "employee",
      targetId: employeeId,
      success: false,
      failureReason: "Please complete all required fields.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Please complete all required fields." };
  }

  const data = parsed.data;
  const attemptedLabel = `Employee: ${data.firstName.trim()} ${data.lastName.trim()}`.trim();

  const existing = await prisma.employees.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });
  if (!existing) {
    return { success: false, message: "Employee not found." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.employees.update({
        where: { id: employeeId },
        data: {
          file_number: data.fileNumber.trim(),
          first_name: data.firstName.trim(),
          middle_name: data.middleName?.trim() || null,
          last_name: data.lastName.trim(),
          preferred_name: data.preferredName?.trim() || null,
          gender: data.gender?.trim() || null,
          date_of_birth: data.dateOfBirth?.trim() ? new Date(`${data.dateOfBirth}T12:00:00`) : null,
          nationality: data.nationality?.trim() || null,
          marital_status: data.maritalStatus?.trim() || null,
          personal_email: data.personalEmail?.trim() || null,
          work_email: data.workEmail?.trim() || null,
          mobile_number: data.mobileNumber?.trim() || null,
          home_number: data.homeNumber?.trim() || null,
          photo_url: data.photoUrl?.trim() || null,
          updated_at: new Date(),
        },
      });

      await replaceEmployeeChildRecords(tx, employeeId, data);
    });

    revalidatePath("/employees");
    revalidatePath(`/employees/${employeeId}`);
    revalidatePath("/employees/directory");
    revalidatePath("/employees/age-monitoring");
    revalidatePath("/");
    await createSystemAuditLog({
      actorUserId,
      module: "Employees",
      action: "edited_employee",
      targetType: "employee",
      targetId: employeeId,
      targetLabel: attemptedLabel,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: true, message: "Employee updated successfully." };
  } catch (error) {
    let failureMessage = "Failed to update employee. Please try again.";
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(",") : String(error.meta?.target ?? "");
      const normalized = target.toLowerCase();
      if (normalized.includes("file_number")) {
        failureMessage = "File number already exists. Please use a unique file number.";
      } else if (normalized.includes("identification") || normalized.includes("id_number") || normalized.includes("normalized_id_number")) {
        failureMessage = "Identification number already exists. Please check the ID details.";
      } else {
        failureMessage = "A record with the same unique value already exists.";
      }
    }
    await createSystemAuditLog({
      actorUserId,
      module: "Employees",
      action: "edited_employee",
      targetType: "employee",
      targetId: employeeId,
      targetLabel: attemptedLabel,
      success: false,
      failureReason: failureMessage,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      console.error("[employees:update] failed", error);
    }
    return { success: false, message: failureMessage };
  }
}
