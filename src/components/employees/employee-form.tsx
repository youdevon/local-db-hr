"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm, type SubmitErrorHandler } from "react-hook-form";

import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createEmployeeAction,
  deleteEmployeeAction,
  updateEmployeeAction,
  type DeleteEmployeeMode,
} from "@/actions/employees";
import {
  EMPLOYEE_ID_TYPES,
  GENDER_OPTIONS,
  MARITAL_STATUS_OPTIONS,
} from "@/lib/employee-constants";
import { defaultEmptyEmployeeForm, type EmployeeRecord } from "@/lib/mock/employees";
import { nationalities } from "@/lib/nationalities";
import {
  notifyError,
  notifyItemCreateFailed,
  notifyItemCreated,
  notifyItemDeleted,
  notifyItemUpdateFailed,
  notifyItemUpdated,
} from "@/lib/notify";
import {
  employeeFormSchema,
  type EmployeeFormValues,
} from "@/lib/validators/employee-form";
import { cn } from "@/lib/utils";

const floatingCard =
  "rounded-xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.08)] ring-1 ring-foreground/[0.04] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] dark:ring-white/[0.06]";

const selectClass =
  "border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function newIdentificationRow(): Omit<EmployeeFormValues["identifications"][number], never> {
  const sid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    sid,
    idType: "",
    idNumber: "",
    issuingCountry: "Trinidad and Tobago",
    issueDate: "",
    expiryDate: "",
    isPrimary: false,
    notes: "",
  };
}

function normalizeIdNumber(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

type CreateActionResult = {
  success: boolean;
  message: string;
  employeeId?: string;
};

export type EmployeeFormProps = {
  mode: "create" | "edit";
  employeeId?: string;
  initialValues?: EmployeeFormValues;
  existingEmployees: EmployeeRecord[];
  canDelete?: boolean;
};

export function EmployeeForm({
  mode,
  employeeId,
  initialValues,
  existingEmployees,
  canDelete = false,
}: EmployeeFormProps) {
  const router = useRouter();
  const [photoBroken, setPhotoBroken] = useState(false);
  const [deleteOptionsOpen, setDeleteOptionsOpen] = useState(false);
  const [confirmDeleteMode, setConfirmDeleteMode] = useState<DeleteEmployeeMode | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: initialValues ?? defaultEmptyEmployeeForm,
  });

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "identifications",
  });

  const photoUrl = watch("photoUrl");
  const firstName = watch("firstName");
  const lastName = watch("lastName");
  const nationality = watch("nationality");
  const mailingSameAsResidential = watch("mailingSameAsResidential");
  const workPermitRequired = watch("workPermitRequired");

  useEffect(() => {
    setPhotoBroken(false);
  }, [photoUrl]);

  useEffect(() => {
    if (mailingSameAsResidential) {
      setValue("mailingAddressLine1", "");
      setValue("mailingAddressLine2", "");
      setValue("mailingCommunityCity", "");
      setValue("mailingRegionMunicipality", "");
      setValue("mailingCountry", "Trinidad and Tobago");
      setValue("mailingPostalCode", "");
    }
  }, [mailingSameAsResidential, setValue]);

  useEffect(() => {
    if (nationality?.trim().toLowerCase() === "trinidad and tobago") {
      setValue("countryOfCitizenship", "Trinidad and Tobago");
    }
  }, [nationality, setValue]);

  function validateDuplicateIdsInForm(data: EmployeeFormValues): boolean {
    const seen = new Set<string>();
    for (const id of data.identifications) {
      const normalized = normalizeIdNumber(id.idNumber ?? "");
      if (!normalized) continue;
      if (seen.has(normalized)) {
        notifyError("Duplicate ID numbers entered. Please review the Identification Details section.");
        return false;
      }
      seen.add(normalized);
    }
    return true;
  }

  async function runCreateAction(data: EmployeeFormValues): Promise<CreateActionResult> {
    const existingRows = existingEmployees.filter((employee) =>
      mode === "edit" && employeeId ? employee.id !== employeeId : true,
    );

    const normalizedFileNumber = data.fileNumber.trim().toLowerCase();

    if (
      existingRows.some((employee) => employee.fileNumber.trim().toLowerCase() === normalizedFileNumber)
    ) {
      return {
        success: false,
        message: "File number already exists.",
      };
    }

    const enteredEmails = [data.personalEmail, data.workEmail]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (
      enteredEmails.some((email) =>
        existingRows.some(
          (employee) =>
            employee.personalEmail.trim().toLowerCase() === email ||
            employee.workEmail.trim().toLowerCase() === email,
        ),
      )
    ) {
      return {
        success: false,
        message: "Email address already exists. Please use a unique email address.",
      };
    }

    const enteredIdNumbers = data.identifications
      .map((identification) => normalizeIdNumber(identification.idNumber ?? ""))
      .filter(Boolean);
    if (
      enteredIdNumbers.some((enteredId) =>
        existingRows.some((employee) =>
          employee.identifications.some(
            (identification) => normalizeIdNumber(identification.idNumber ?? "") === enteredId,
          ),
        ),
      )
    ) {
      return {
        success: false,
        message: "Identification number already exists. Please check the ID details.",
      };
    }

    const result = await createEmployeeAction(data);
    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }
    return {
      success: true,
      message: "Employee created successfully.",
      employeeId: result.employeeId,
    };
  }

  async function runUpdateAction(employeeIdParam: string, data: EmployeeFormValues): Promise<CreateActionResult> {
    const existingRows = existingEmployees.filter((employee) => employee.id !== employeeIdParam);

    const normalizedFileNumber = data.fileNumber.trim().toLowerCase();

    if (existingRows.some((employee) => employee.fileNumber.trim().toLowerCase() === normalizedFileNumber)) {
      return {
        success: false,
        message: "File number already exists.",
      };
    }

    const enteredEmails = [data.personalEmail, data.workEmail]
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (
      enteredEmails.some((email) =>
        existingRows.some(
          (employee) =>
            employee.personalEmail.trim().toLowerCase() === email ||
            employee.workEmail.trim().toLowerCase() === email,
        ),
      )
    ) {
      return {
        success: false,
        message: "Email address already exists. Please use a unique email address.",
      };
    }

    const enteredIdNumbers = data.identifications
      .map((identification) => normalizeIdNumber(identification.idNumber ?? ""))
      .filter(Boolean);
    if (
      enteredIdNumbers.some((enteredId) =>
        existingRows.some((employee) =>
          employee.identifications.some(
            (identification) => normalizeIdNumber(identification.idNumber ?? "") === enteredId,
          ),
        ),
      )
    ) {
      return {
        success: false,
        message: "Identification number already exists. Please check the ID details.",
      };
    }

    const result = await updateEmployeeAction(employeeIdParam, data);
    if (!result.success) {
      return {
        success: false,
        message: result.message,
      };
    }
    return {
      success: true,
      message: "Employee updated successfully.",
    };
  }

  const onInvalidSubmit: SubmitErrorHandler<EmployeeFormValues> = (formErrors) => {
    if (formErrors.fileNumber) return notifyError("File number is required.");
    if (formErrors.firstName) return notifyError("First name is required.");
    if (formErrors.lastName) return notifyError("Last name is required.");
    if (formErrors.addressLine1 || formErrors.communityCity) {
      return notifyError("Residential address is required.");
    }
    if (
      formErrors.emergencyContactName ||
      formErrors.emergencyContactRelationship ||
      formErrors.emergencyContactMobileNumber
    ) {
      return notifyError("Primary emergency contact is required.");
    }
    if (formErrors.workPermitNumber || formErrors.workPermitExpiryDate) {
      return notifyError("Please complete all required fields.");
    }
    return notifyError("Please complete all required fields.");
  };

  async function onSubmit(data: EmployeeFormValues) {
    try {
      if (mode === "create") {
        if (!validateDuplicateIdsInForm(data)) return;
        const result = await runCreateAction(data);
        if (!result.success) {
          notifyError(result.message || "Failed to create employee. Please try again.");
          return;
        }
        notifyItemCreated("employee");
        router.push("/employees");
        router.refresh();
      } else if (employeeId) {
        if (!validateDuplicateIdsInForm(data)) return;
        const result = await runUpdateAction(employeeId, data);
        if (!result.success) {
          notifyError(result.message || "Failed to update employee. Please try again.");
          return;
        }
        notifyItemUpdated("employee");
        router.push(`/employees/${employeeId}`);
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "";
      if (msg) notifyError(msg);
      else if (mode === "create") notifyItemCreateFailed("employee");
      else notifyItemUpdateFailed("employee");
    }
  }

  async function handleDelete(modeToDelete: DeleteEmployeeMode) {
    if (!employeeId) return;
    setDeletePending(true);
    try {
      const result = await deleteEmployeeAction(employeeId, modeToDelete);
      if (!result.success) {
        notifyError(result.message || "Failed to delete employee. Please try again.");
        return;
      }
      notifyItemDeleted("employee");
      router.push("/employees");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Failed to delete employee. Please try again.";
      notifyError(msg);
    } finally {
      setDeletePending(false);
      setConfirmDeleteMode(null);
    }
  }

  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.trim().toUpperCase() || "?";

  const cancelHref = mode === "edit" && employeeId ? `/employees/${employeeId}` : "/employees";
  const identificationCard = (
    <section className={cn(floatingCard, "space-y-4")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-heading text-foreground text-base font-bold tracking-tight">Identification Details</h2>
          <p className="text-muted-foreground text-sm">
            Employees may have multiple identification records. ID numbers must be unique and duplicate ID numbers
            will not be allowed.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => append(newIdentificationRow())}
        >
          <Plus className="size-4" aria-hidden />
          Add ID
        </Button>
      </div>
      <p className="text-muted-foreground bg-muted/40 border-border rounded-md border px-3 py-2 text-xs leading-relaxed">
        Expiry date is recommended for Passport, Driver Permit, and Work Permit records.
      </p>
      {errors.identifications?.message ? (
        <p className="text-destructive text-sm">{errors.identifications.message}</p>
      ) : null}
      {errors.identifications?.root?.message ? (
        <p className="text-destructive text-sm">{String(errors.identifications.root.message)}</p>
      ) : null}

      <div className="space-y-4">
        {fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">No identification records yet. Use Add ID to begin.</p>
        ) : null}
        {fields.map((field, index) => (
          <div
            key={field.id}
            className="border-border bg-muted/10 space-y-4 rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-foreground text-sm font-medium">Identification {index + 1}</p>
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => remove(index)}>
                <Trash2 className="size-4" aria-hidden />
                Remove
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="ID type">
                <select className={selectClass} {...register(`identifications.${index}.idType`)}>
                  <option value="">Select...</option>
                  {EMPLOYEE_ID_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="ID number">
                <Input className="h-10 rounded-lg" {...register(`identifications.${index}.idNumber`)} />
              </Field>
              <Field label="Issuing country">
                <Input className="h-10 rounded-lg" {...register(`identifications.${index}.issuingCountry`)} />
              </Field>
              <Field label="Issue date">
                <Input className="h-10 rounded-lg" type="date" {...register(`identifications.${index}.issueDate`)} />
              </Field>
              <Field label="Expiry date">
                <Input className="h-10 rounded-lg" type="date" {...register(`identifications.${index}.expiryDate`)} />
              </Field>
              <div className="flex items-end gap-2 pb-2">
                <Controller
                  control={control}
                  name={`identifications.${index}.isPrimary`}
                  render={({ field: pf }) => (
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="border-input size-4 rounded border"
                        checked={pf.value}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (checked) {
                            fields.forEach((_, j) => {
                              setValue(`identifications.${j}.isPrimary`, j === index);
                            });
                          } else {
                            setValue(`identifications.${index}.isPrimary`, false);
                          }
                        }}
                      />
                      Primary ID
                    </label>
                  )}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Notes">
                  <Input className="h-10 rounded-lg" {...register(`identifications.${index}.notes`)} />
                </Field>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalidSubmit)} className="space-y-6">
      <section className={cn(floatingCard, "space-y-4")}>
        <div>
          <h2 className="font-heading text-foreground text-base font-bold tracking-tight">Personal details</h2>
          <p className="text-muted-foreground text-sm">Legal name and personal attributes.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="File number" required error={errors.fileNumber?.message}>
            <Input className="h-10 rounded-lg" {...register("fileNumber")} />
          </Field>
          <Field label="First name" required error={errors.firstName?.message}>
            <Input className="h-10 rounded-lg" {...register("firstName")} />
          </Field>
          <Field label="Middle name" error={errors.middleName?.message}>
            <Input className="h-10 rounded-lg" {...register("middleName")} />
          </Field>
          <Field label="Last name" required error={errors.lastName?.message}>
            <Input className="h-10 rounded-lg" {...register("lastName")} />
          </Field>
          <Field label="Preferred name" error={errors.preferredName?.message}>
            <Input className="h-10 rounded-lg" {...register("preferredName")} />
          </Field>
          <Field label="Gender" error={errors.gender?.message}>
            <select className={selectClass} {...register("gender")}>
              <option value="">Select…</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date of birth" error={errors.dateOfBirth?.message}>
            <Input className="h-10 rounded-lg" type="date" {...register("dateOfBirth")} />
          </Field>
          <Field label="Nationality" error={errors.nationality?.message}>
            <select className={selectClass} {...register("nationality")}>
              <option value="">Select...</option>
              {nationalities.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Marital status" error={errors.maritalStatus?.message}>
            <select className={selectClass} {...register("maritalStatus")}>
              <option value="">Select…</option>
              {MARITAL_STATUS_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personal email" error={errors.personalEmail?.message}>
            <Input className="h-10 rounded-lg" type="email" autoComplete="email" {...register("personalEmail")} />
          </Field>
          <Field label="Work email" error={errors.workEmail?.message}>
            <Input className="h-10 rounded-lg" type="email" autoComplete="email" {...register("workEmail")} />
          </Field>
          <Field label="Mobile number" error={errors.mobileNumber?.message}>
            <Input className="h-10 rounded-lg" {...register("mobileNumber")} />
          </Field>
          <Field label="Home number" error={errors.homeNumber?.message}>
            <Input className="h-10 rounded-lg" {...register("homeNumber")} />
          </Field>
        </div>
      </section>

      {identificationCard}

      <section className={cn(floatingCard, "space-y-4")}>
        <div>
          <h2 className="font-heading text-foreground text-base font-bold tracking-tight">Address Information</h2>
          <p className="text-muted-foreground text-sm">Residential and mailing address details.</p>
        </div>
        <div className="space-y-4">
          <div className="border-border bg-muted/10 space-y-4 rounded-xl border p-4">
            <h3 className="text-foreground text-sm font-semibold">Residential Address</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Address Line 1" required error={errors.addressLine1?.message}>
                  <Input className="h-10 rounded-lg" {...register("addressLine1")} />
                </Field>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Address Line 2" error={errors.addressLine2?.message}>
                  <Input className="h-10 rounded-lg" {...register("addressLine2")} />
                </Field>
              </div>
              <Field label="Community / City" required error={errors.communityCity?.message}>
                <Input className="h-10 rounded-lg" {...register("communityCity")} />
              </Field>
              <Field label="Region / Municipality" error={errors.regionMunicipality?.message}>
                <Input className="h-10 rounded-lg" {...register("regionMunicipality")} />
              </Field>
              <Field label="Country" required error={errors.country?.message}>
                <Input className="h-10 rounded-lg" {...register("country")} />
              </Field>
              <Field label="Postal Code" error={errors.postalCode?.message}>
                <Input className="h-10 rounded-lg" {...register("postalCode")} />
              </Field>
            </div>
          </div>

          <div className="border-border bg-muted/10 space-y-4 rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-foreground text-sm font-semibold">Mailing Address</h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="border-input size-4 rounded border"
                  {...register("mailingSameAsResidential")}
                />
                Same as Residential Address
              </label>
            </div>
            {!mailingSameAsResidential ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Mailing Address Line 1" error={errors.mailingAddressLine1?.message}>
                    <Input className="h-10 rounded-lg" {...register("mailingAddressLine1")} />
                  </Field>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Mailing Address Line 2" error={errors.mailingAddressLine2?.message}>
                    <Input className="h-10 rounded-lg" {...register("mailingAddressLine2")} />
                  </Field>
                </div>
                <Field label="Mailing Community / City" error={errors.mailingCommunityCity?.message}>
                  <Input className="h-10 rounded-lg" {...register("mailingCommunityCity")} />
                </Field>
                <Field
                  label="Mailing Region / Municipality"
                  error={errors.mailingRegionMunicipality?.message}
                >
                  <Input className="h-10 rounded-lg" {...register("mailingRegionMunicipality")} />
                </Field>
                <Field label="Mailing Country" error={errors.mailingCountry?.message}>
                  <Input className="h-10 rounded-lg" {...register("mailingCountry")} />
                </Field>
                <Field label="Mailing Postal Code" error={errors.mailingPostalCode?.message}>
                  <Input className="h-10 rounded-lg" {...register("mailingPostalCode")} />
                </Field>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Mailing address will use the residential address.</p>
            )}
          </div>
        </div>
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <div>
          <h2 className="font-heading text-foreground text-base font-bold tracking-tight">Emergency Contact Information</h2>
          <p className="text-muted-foreground text-sm">Emergency contacts and next of kin records.</p>
        </div>
        <div className="space-y-4">
          <div className="border-border bg-muted/10 space-y-4 rounded-xl border p-4">
            <h3 className="text-foreground text-sm font-semibold">Primary Emergency Contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact Name" required error={errors.emergencyContactName?.message}>
                <Input className="h-10 rounded-lg" {...register("emergencyContactName")} />
              </Field>
              <Field label="Relationship" required error={errors.emergencyContactRelationship?.message}>
                <Input className="h-10 rounded-lg" {...register("emergencyContactRelationship")} />
              </Field>
              <Field label="Mobile Number" required error={errors.emergencyContactMobileNumber?.message}>
                <Input className="h-10 rounded-lg" {...register("emergencyContactMobileNumber")} />
              </Field>
              <Field label="Alternative Number" error={errors.emergencyContactAlternativeNumber?.message}>
                <Input className="h-10 rounded-lg" {...register("emergencyContactAlternativeNumber")} />
              </Field>
              <Field label="Email" error={errors.emergencyContactEmail?.message}>
                <Input className="h-10 rounded-lg" type="email" {...register("emergencyContactEmail")} />
              </Field>
              <Field label="Address" error={errors.emergencyContactAddress?.message}>
                <Input className="h-10 rounded-lg" {...register("emergencyContactAddress")} />
              </Field>
            </div>
          </div>

          <div className="border-border bg-muted/10 space-y-4 rounded-xl border p-4">
            <h3 className="text-foreground text-sm font-semibold">Secondary Emergency Contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact Name" error={errors.secondaryEmergencyContactName?.message}>
                <Input className="h-10 rounded-lg" {...register("secondaryEmergencyContactName")} />
              </Field>
              <Field label="Relationship" error={errors.secondaryEmergencyContactRelationship?.message}>
                <Input className="h-10 rounded-lg" {...register("secondaryEmergencyContactRelationship")} />
              </Field>
              <Field label="Mobile Number" error={errors.secondaryEmergencyContactMobileNumber?.message}>
                <Input className="h-10 rounded-lg" {...register("secondaryEmergencyContactMobileNumber")} />
              </Field>
              <Field
                label="Alternative Number"
                error={errors.secondaryEmergencyContactAlternativeNumber?.message}
              >
                <Input className="h-10 rounded-lg" {...register("secondaryEmergencyContactAlternativeNumber")} />
              </Field>
              <Field label="Email" error={errors.secondaryEmergencyContactEmail?.message}>
                <Input className="h-10 rounded-lg" type="email" {...register("secondaryEmergencyContactEmail")} />
              </Field>
              <Field label="Address" error={errors.secondaryEmergencyContactAddress?.message}>
                <Input className="h-10 rounded-lg" {...register("secondaryEmergencyContactAddress")} />
              </Field>
            </div>
          </div>

          <div className="border-border bg-muted/10 space-y-4 rounded-xl border p-4">
            <h3 className="text-foreground text-sm font-semibold">Next of Kin</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" error={errors.nextOfKinFullName?.message}>
                <Input className="h-10 rounded-lg" {...register("nextOfKinFullName")} />
              </Field>
              <Field label="Relationship" error={errors.nextOfKinRelationship?.message}>
                <Input className="h-10 rounded-lg" {...register("nextOfKinRelationship")} />
              </Field>
              <Field label="Mobile Number" error={errors.nextOfKinMobileNumber?.message}>
                <Input className="h-10 rounded-lg" {...register("nextOfKinMobileNumber")} />
              </Field>
              <Field label="Alternative Number" error={errors.nextOfKinAlternativeNumber?.message}>
                <Input className="h-10 rounded-lg" {...register("nextOfKinAlternativeNumber")} />
              </Field>
              <Field label="Email" error={errors.nextOfKinEmail?.message}>
                <Input className="h-10 rounded-lg" type="email" {...register("nextOfKinEmail")} />
              </Field>
              <Field label="Address" error={errors.nextOfKinAddress?.message}>
                <Input className="h-10 rounded-lg" {...register("nextOfKinAddress")} />
              </Field>
            </div>
          </div>
        </div>
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <div>
          <h2 className="font-heading text-foreground text-base font-bold tracking-tight">
            Right to Work / Immigration Information
          </h2>
          <p className="text-muted-foreground text-sm">
            Use this section for non-nationals or employees whose right-to-work status must be verified.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="border-input size-4 rounded border"
              {...register("workPermitRequired")}
            />
            Work permit required
          </label>
          <Field label="Work permit number" error={errors.workPermitNumber?.message}>
            <Input
              className="h-10 rounded-lg"
              disabled={!workPermitRequired}
              {...register("workPermitNumber")}
            />
          </Field>
          <Field label="Work permit expiry date" error={errors.workPermitExpiryDate?.message}>
            <Input
              className="h-10 rounded-lg"
              type="date"
              disabled={!workPermitRequired}
              {...register("workPermitExpiryDate")}
            />
          </Field>
          <Field label="Immigration status" error={errors.immigrationStatus?.message}>
            <Input className="h-10 rounded-lg" {...register("immigrationStatus")} />
          </Field>
          <Field label="Country of citizenship" error={errors.countryOfCitizenship?.message}>
            <Input className="h-10 rounded-lg" {...register("countryOfCitizenship")} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="border-input size-4 rounded border"
              {...register("rightToWorkConfirmed")}
            />
            Right to work confirmed
          </label>
        </div>
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <div>
          <h2 className="font-heading text-foreground text-base font-bold tracking-tight">Photo</h2>
          <p className="text-muted-foreground text-sm">Image URL for the employee portrait (preview only for now).</p>
        </div>
        <Field label="Photo URL" error={errors.photoUrl?.message}>
          <Input className="h-10 rounded-lg" placeholder="https://…" {...register("photoUrl")} />
        </Field>
        <div className="flex items-center gap-4">
          <div className="border-border bg-muted/30 relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm">
            {photoUrl?.trim() && !photoBroken ? (
              // eslint-disable-next-line @next/next/no-img-element -- user-supplied arbitrary URL for preview
              <img
                src={photoUrl.trim()}
                alt=""
                className="size-full object-cover"
                onError={() => setPhotoBroken(true)}
              />
            ) : (
              <span className="text-primary text-sm font-semibold" aria-hidden>
                {initials}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Preview updates as you type a valid image URL.</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSubmitting} className="min-w-[10rem]">
          {mode === "create" ? "Save Employee" : "Save changes"}
        </Button>
        {mode === "edit" && employeeId && canDelete ? (
          <Button
            type="button"
            variant="destructive"
            disabled={isSubmitting || deletePending}
            onClick={() => setDeleteOptionsOpen(true)}
          >
            Delete
          </Button>
        ) : null}
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>

      <Dialog open={deleteOptionsOpen} onOpenChange={setDeleteOptionsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
            <DialogDescription>
              Choose how you want to delete this employee record. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={deletePending}
              onClick={() => {
                setDeleteOptionsOpen(false);
                setConfirmDeleteMode("employee_only");
              }}
            >
              Delete Employee Only
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="w-full"
              disabled={deletePending}
              onClick={() => {
                setDeleteOptionsOpen(false);
                setConfirmDeleteMode("employee_and_contracts");
              }}
            >
              Delete Employee and Contracts
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setDeleteOptionsOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteMode === "employee_only"}
        onOpenChange={(open) => !open && setConfirmDeleteMode(null)}
        title="Confirm Delete Employee Only"
        description="This deletes the employee and employee-level leave records only. If contracts still exist, deletion will be blocked and you should use Delete Employee and Contracts instead."
        confirmLabel="Delete Employee Only"
        confirmVariant="destructive"
        pending={deletePending}
        onConfirm={() => handleDelete("employee_only")}
      />

      <ConfirmDialog
        open={confirmDeleteMode === "employee_and_contracts"}
        onOpenChange={(open) => !open && setConfirmDeleteMode(null)}
        title="Confirm Delete Employee and Contracts"
        description="This deletes the employee, all related contracts, contract child records, and leave records linked to the employee and those contracts."
        confirmLabel="Delete Employee and Contracts"
        confirmVariant="destructive"
        pending={deletePending}
        onConfirm={() => handleDelete("employee_and_contracts")}
      />
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
