"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getEmployeeAuditTargetLabel } from "@/lib/audit-employee-target";
import { prisma } from "@/lib/prisma";
import {
  type UpdateOwnEmployeePersonalInfoInput,
  updateOwnEmployeePersonalInfoSchema,
} from "@/lib/validators/profile-self-service";

type UpdateOwnPersonalInfoResult =
  | { success: true; message: "Your personal information was updated successfully." }
  | { success: false; message: string };

function normalizeOptional(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length ? trimmed : null;
}

export async function updateOwnEmployeePersonalInfoAction(
  input: unknown,
): Promise<UpdateOwnPersonalInfoResult> {
  const user = await requireUser();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  const profile = await prisma.userProfile.findUnique({
    where: { user_id: user.userId },
    select: { employee_id: true },
  });

  if (!profile?.employee_id) {
    return {
      success: false,
      message: "Your user account is not linked to an employee profile.",
    };
  }

  const parsed = updateOwnEmployeePersonalInfoSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || "Please check your personal information entries.",
    };
  }

  const data: UpdateOwnEmployeePersonalInfoInput = parsed.data;
  const employeeId = profile.employee_id;

  const existingEmployee = await prisma.employees.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      mobile_number: true,
      home_number: true,
      personal_email: true,
    },
  });
  if (!existingEmployee) {
    return {
      success: false,
      message: "You can only update your own personal information.",
    };
  }

  const existingAddress = await prisma.employee_addresses.findFirst({
    where: { employee_id: employeeId, address_type: "residential" },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
  });
  const existingEmergency = await prisma.employee_emergency_contacts.findFirst({
    where: { employee_id: employeeId, contact_type: "primary_emergency" },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
  });
  const existingNextOfKin = await prisma.employee_emergency_contacts.findFirst({
    where: { employee_id: employeeId, contact_type: "next_of_kin" },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
  });

  type AuditCh = {
    field: string;
    label?: string;
    type: "changed";
    before?: unknown;
    after?: unknown;
    format?: "text";
  };

  const changes: AuditCh[] = [];
  function push(field: string, label: string, before: string | null, after: string | null) {
    const b = (before ?? "").trim();
    const a = (after ?? "").trim();
    if (b === a) return;
    changes.push({
      field,
      label,
      type: "changed",
      before: b.length ? b : "—",
      after: a.length ? a : "—",
      format: "text",
    });
  }

  push(
    "mobile_number",
    "Mobile number",
    existingEmployee.mobile_number ?? null,
    normalizeOptional(data.mobileNumber),
  );
  push(
    "home_number",
    "Home phone",
    existingEmployee.home_number ?? null,
    normalizeOptional(data.homeNumber),
  );
  push(
    "personal_email",
    "Personal email",
    existingEmployee.personal_email ?? null,
    normalizeOptional(data.personalEmail),
  );

  push(
    "address_line_1",
    "Address line 1",
    existingAddress?.address_line_1 ?? null,
    data.addressLine1.trim(),
  );
  push(
    "address_line_2",
    "Address line 2",
    existingAddress?.address_line_2 ?? null,
    normalizeOptional(data.addressLine2),
  );
  push(
    "community_city",
    "City / community",
    existingAddress?.community_city ?? null,
    data.communityCity.trim(),
  );
  push(
    "region_municipality",
    "Region",
    existingAddress?.region_municipality ?? null,
    normalizeOptional(data.regionMunicipality),
  );
  push(
    "country",
    "Country",
    existingAddress?.country ?? null,
    data.country.trim(),
  );
  push(
    "postal_code",
    "Postal code",
    existingAddress?.postal_code ?? null,
    normalizeOptional(data.postalCode),
  );

  push(
    "emergency_contact_name",
    "Emergency contact name",
    existingEmergency?.contact_name ?? null,
    data.emergencyContactName.trim(),
  );
  push(
    "emergency_contact_relationship",
    "Emergency contact relationship",
    existingEmergency?.relationship ?? null,
    data.emergencyContactRelationship.trim(),
  );
  push(
    "emergency_contact_mobile",
    "Emergency contact mobile",
    existingEmergency?.mobile_number ?? null,
    data.emergencyContactMobileNumber.trim(),
  );
  push(
    "emergency_contact_alt",
    "Emergency contact alternate phone",
    existingEmergency?.alternative_number ?? null,
    normalizeOptional(data.emergencyContactAlternativeNumber),
  );
  push(
    "emergency_contact_email",
    "Emergency contact email",
    existingEmergency?.email ?? null,
    normalizeOptional(data.emergencyContactEmail),
  );
  push(
    "emergency_contact_address",
    "Emergency contact address",
    existingEmergency?.address ?? null,
    normalizeOptional(data.emergencyContactAddress),
  );

  push(
    "next_of_kin_name",
    "Next of kin name",
    existingNextOfKin?.contact_name ?? null,
    data.nextOfKinFullName.trim(),
  );
  push(
    "next_of_kin_relationship",
    "Next of kin relationship",
    existingNextOfKin?.relationship ?? null,
    data.nextOfKinRelationship.trim(),
  );
  push(
    "next_of_kin_mobile",
    "Next of kin mobile",
    existingNextOfKin?.mobile_number ?? null,
    data.nextOfKinMobileNumber.trim(),
  );
  push(
    "next_of_kin_alt",
    "Next of kin alternate phone",
    existingNextOfKin?.alternative_number ?? null,
    normalizeOptional(data.nextOfKinAlternativeNumber),
  );
  push(
    "next_of_kin_email",
    "Next of kin email",
    existingNextOfKin?.email ?? null,
    normalizeOptional(data.nextOfKinEmail),
  );
  push(
    "next_of_kin_address",
    "Next of kin address",
    existingNextOfKin?.address ?? null,
    normalizeOptional(data.nextOfKinAddress),
  );

  const changedSections = new Set<string>();
  for (const c of changes) {
    const f = c.field;
    if (
      f === "mobile_number" ||
      f === "home_number" ||
      f === "personal_email"
    ) {
      changedSections.add("phone/contact");
    } else if (
      f.startsWith("address_") ||
      f === "community_city" ||
      f === "region_municipality" ||
      f === "country" ||
      f === "postal_code"
    ) {
      changedSections.add("address");
    } else if (f.startsWith("emergency_contact")) {
      changedSections.add("emergency contact");
    } else if (f.startsWith("next_of_kin")) {
      changedSections.add("next of kin");
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.employees.update({
      where: { id: employeeId },
      data: {
        mobile_number: normalizeOptional(data.mobileNumber),
        home_number: normalizeOptional(data.homeNumber),
        personal_email: normalizeOptional(data.personalEmail),
        updated_at: new Date(),
      },
    });

    if (existingAddress) {
      await tx.employee_addresses.update({
        where: { id: existingAddress.id },
        data: {
          address_line_1: data.addressLine1.trim(),
          address_line_2: normalizeOptional(data.addressLine2),
          community_city: data.communityCity.trim(),
          region_municipality: normalizeOptional(data.regionMunicipality),
          country: data.country.trim(),
          postal_code: normalizeOptional(data.postalCode),
          updated_at: new Date(),
        },
      });
    } else {
      await tx.employee_addresses.create({
        data: {
          employee_id: employeeId,
          address_type: "residential",
          address_line_1: data.addressLine1.trim(),
          address_line_2: normalizeOptional(data.addressLine2),
          community_city: data.communityCity.trim(),
          region_municipality: normalizeOptional(data.regionMunicipality),
          country: data.country.trim(),
          postal_code: normalizeOptional(data.postalCode),
          same_as_residential: false,
          is_primary: true,
        },
      });
    }

    if (existingEmergency) {
      await tx.employee_emergency_contacts.update({
        where: { id: existingEmergency.id },
        data: {
          contact_name: data.emergencyContactName.trim(),
          relationship: data.emergencyContactRelationship.trim(),
          mobile_number: data.emergencyContactMobileNumber.trim(),
          alternative_number: normalizeOptional(data.emergencyContactAlternativeNumber),
          email: normalizeOptional(data.emergencyContactEmail),
          address: normalizeOptional(data.emergencyContactAddress),
          is_primary: true,
          updated_at: new Date(),
        },
      });
    } else {
      await tx.employee_emergency_contacts.create({
        data: {
          employee_id: employeeId,
          contact_type: "primary_emergency",
          contact_name: data.emergencyContactName.trim(),
          relationship: data.emergencyContactRelationship.trim(),
          mobile_number: data.emergencyContactMobileNumber.trim(),
          alternative_number: normalizeOptional(data.emergencyContactAlternativeNumber),
          email: normalizeOptional(data.emergencyContactEmail),
          address: normalizeOptional(data.emergencyContactAddress),
          is_primary: true,
        },
      });
    }

    if (existingNextOfKin) {
      await tx.employee_emergency_contacts.update({
        where: { id: existingNextOfKin.id },
        data: {
          contact_name: data.nextOfKinFullName.trim(),
          relationship: data.nextOfKinRelationship.trim(),
          mobile_number: data.nextOfKinMobileNumber.trim(),
          alternative_number: normalizeOptional(data.nextOfKinAlternativeNumber),
          email: normalizeOptional(data.nextOfKinEmail),
          address: normalizeOptional(data.nextOfKinAddress),
          is_primary: false,
          updated_at: new Date(),
        },
      });
    } else {
      await tx.employee_emergency_contacts.create({
        data: {
          employee_id: employeeId,
          contact_type: "next_of_kin",
          contact_name: data.nextOfKinFullName.trim(),
          relationship: data.nextOfKinRelationship.trim(),
          mobile_number: data.nextOfKinMobileNumber.trim(),
          alternative_number: normalizeOptional(data.nextOfKinAlternativeNumber),
          email: normalizeOptional(data.nextOfKinEmail),
          address: normalizeOptional(data.nextOfKinAddress),
          is_primary: false,
        },
      });
    }
  });

  await createSystemAuditLog({
    actorUserId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
    module: "employee_profile",
    action: "employee_profile_updated",
    targetType: "employee",
    targetId: employeeId,
    targetLabel: await getEmployeeAuditTargetLabel(employeeId),
    success: true,
    metadata: {
      summary: "Employee updated own personal profile information.",
      selfService: true,
      changedSections: Array.from(changedSections),
      changes,
    },
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });

  revalidatePath("/profile");
  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/employees");

  return { success: true, message: "Your personal information was updated successfully." };
}

/** Alias for self-service profile updates (own record only; see implementation above). */
export const updateOwnProfilePersonalInfoAction = updateOwnEmployeePersonalInfoAction;
