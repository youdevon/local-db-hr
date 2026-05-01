"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmployeeRecord } from "@/lib/mock/employees";
import {
  calculateAge,
  formatEmployeeDateDisplay,
  getPrimaryResidentialAddress,
  getMailingAddress,
  getNextOfKinContact,
  getPrimaryEmergencyContact,
  getSecondaryEmergencyContact,
} from "@/lib/mock/employees";
import { getContractDisplayStatus, getContractDisplayStatusTone } from "@/lib/contract-display-status";
import { cn } from "@/lib/utils";

const panel =
  "rounded-xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] ring-1 ring-foreground/[0.04] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] dark:ring-white/[0.06]";

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="text-foreground text-sm font-medium break-words">{value ?? "—"}</div>
    </div>
  );
}

export function EmployeeDetailTabs({
  employee,
  allowMutations = true,
}: {
  employee: EmployeeRecord;
  /** When false (e.g. viewer role), hide document action column and any mutation affordances. */
  allowMutations?: boolean;
}) {
  const router = useRouter();
  const age = calculateAge(employee.dateOfBirth);
  const history = employee.positionHistory ?? [];
  const sortedHistory = history
    .filter((row) => Boolean(row.relatedContractId))
    .sort((a, b) => {
    const nowIso = new Date().toISOString().slice(0, 10);
    const aCurrent = Boolean(a.startDate && (a.endDate === null || a.endDate >= nowIso) && a.startDate <= nowIso);
    const bCurrent = Boolean(b.startDate && (b.endDate === null || b.endDate >= nowIso) && b.startDate <= nowIso);
    if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
    const aFuture = Boolean(a.startDate && a.startDate > nowIso);
    const bFuture = Boolean(b.startDate && b.startDate > nowIso);
    if (aFuture !== bFuture) return aFuture ? -1 : 1;
    const aEnd = a.endDate ?? "";
    const bEnd = b.endDate ?? "";
    if (aEnd !== bEnd) return bEnd.localeCompare(aEnd);
    return b.startDate.localeCompare(a.startDate);
    });
  const shouldScrollHistory = sortedHistory.length > 5;
  const residentialAddress = getPrimaryResidentialAddress(employee);
  const mailingAddress = getMailingAddress(employee);
  const primaryEmergencyContact = getPrimaryEmergencyContact(employee);
  const secondaryEmergencyContact = getSecondaryEmergencyContact(employee);
  const nextOfKin = getNextOfKinContact(employee);
  const documents = employee.documents ?? [];
  const rightToWork = employee.rightToWork;
  const permitExpiry = rightToWork?.workPermitExpiryDate
    ? new Date(`${rightToWork.workPermitExpiryDate}T12:00:00`)
    : null;
  const today = new Date();
  const daysToExpiry = permitExpiry
    ? Math.floor((permitExpiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const permitStatus = !rightToWork?.workPermitRequired
    ? "Not Required"
    : !permitExpiry
      ? "Required"
      : daysToExpiry !== null && daysToExpiry < 0
        ? "Expired"
        : daysToExpiry !== null && daysToExpiry <= 60
          ? "Expiring Soon"
          : "Valid";

  return (
    <Tabs defaultValue="bio-data" className="gap-4">
      <TabsList variant="line" className="flex w-full flex-wrap justify-start gap-1 bg-transparent p-0">
        <TabsTrigger value="bio-data" className="shrink-0">
          Bio Data
        </TabsTrigger>
        <TabsTrigger value="emergency" className="shrink-0">
          Emergency Contacts
        </TabsTrigger>
        <TabsTrigger value="employment" className="shrink-0">
          Employment
        </TabsTrigger>
        <TabsTrigger value="documents" className="shrink-0">
          Documents
        </TabsTrigger>
        <TabsTrigger value="notes" className="shrink-0">
          Notes
        </TabsTrigger>
      </TabsList>

      <TabsContent value="bio-data" className={cn(panel, "mt-0 space-y-5")}>
        <div className="space-y-4">
          <h3 className="text-foreground text-base font-semibold">Employee Bio Data</h3>

          <div className="space-y-3">
            <h4 className="text-foreground text-sm font-semibold">Personal Details</h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="File number" value={employee.fileNumber || "—"} />
              <Field label="First name" value={employee.firstName || "—"} />
              <Field label="Middle name" value={employee.middleName || "—"} />
              <Field label="Last name" value={employee.lastName || "—"} />
              <Field label="Preferred name" value={employee.preferredName || "—"} />
              <Field label="Gender" value={employee.gender || "—"} />
              <Field
                label="Date of birth"
                value={employee.dateOfBirth ? formatEmployeeDateDisplay(employee.dateOfBirth) : "—"}
              />
              <Field label="Age" value={employee.dateOfBirth ? age : "—"} />
              <Field label="Nationality" value={employee.nationality || "—"} />
              <Field label="Marital status" value={employee.maritalStatus || "—"} />
            </div>
          </div>

          <div className="border-border border-t pt-4 space-y-3">
            <h4 className="text-foreground text-sm font-semibold">Identification Details</h4>
            {employee.identifications.length === 0 ? (
              <p className="text-muted-foreground text-sm">No identification records recorded.</p>
            ) : (
              <div className="space-y-3">
                {employee.identifications.map((identification) => (
                  <div key={identification.sid} className="rounded-xl border border-border bg-muted/15 p-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="ID type" value={identification.idType || "—"} />
                      <Field label="ID number" value={identification.idNumber || "—"} />
                      <Field label="Issuing country" value={identification.issuingCountry || "—"} />
                      <Field
                        label="Issue date"
                        value={
                          identification.issueDate ? formatEmployeeDateDisplay(identification.issueDate) : "—"
                        }
                      />
                      <Field
                        label="Expiry date"
                        value={
                          identification.expiryDate ? formatEmployeeDateDisplay(identification.expiryDate) : "—"
                        }
                      />
                      <Field
                        label="Primary ID"
                        value={
                          identification.isPrimary ? (
                            <StatusBadge tone="success">Primary</StatusBadge>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )
                        }
                      />
                      {identification.notes?.trim() ? (
                        <div className="sm:col-span-2 lg:col-span-3">
                          <Field label="Notes" value={identification.notes} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-border border-t pt-4 space-y-3">
            <h4 className="text-foreground text-sm font-semibold">Contact Details</h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Personal email" value={employee.personalEmail || "—"} />
              <Field label="Work email" value={employee.workEmail || "—"} />
              <Field label="Mobile number" value={employee.mobileNumber || "—"} />
              <Field label="Home number" value={employee.homeNumber || "—"} />
            </div>
          </div>

          <div className="border-border border-t pt-4 space-y-3">
            <h4 className="text-foreground text-sm font-semibold">Residential Address</h4>
            {residentialAddress ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Address Line 1" value={residentialAddress.addressLine1 || "—"} />
                <Field label="Address Line 2" value={residentialAddress.addressLine2 || "—"} />
                <Field label="Community / City" value={residentialAddress.communityCity || "—"} />
                <Field
                  label="Region / Municipality"
                  value={residentialAddress.regionMunicipality || "—"}
                />
                <Field label="Country" value={residentialAddress.country || "—"} />
                <Field label="Postal Code" value={residentialAddress.postalCode || "—"} />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No residential address recorded.</p>
            )}
          </div>

          <div className="border-border border-t pt-4 space-y-3">
            <h4 className="text-foreground text-sm font-semibold">Mailing Address</h4>
            {mailingAddress ? (
              mailingAddress.sameAsResidential ? (
                <p className="text-muted-foreground text-sm">Same as residential address</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Mailing Address Line 1" value={mailingAddress.addressLine1 || "—"} />
                  <Field label="Mailing Address Line 2" value={mailingAddress.addressLine2 || "—"} />
                  <Field label="Mailing Community / City" value={mailingAddress.communityCity || "—"} />
                  <Field
                    label="Mailing Region / Municipality"
                    value={mailingAddress.regionMunicipality || "—"}
                  />
                  <Field label="Mailing Country" value={mailingAddress.country || "—"} />
                  <Field label="Mailing Postal Code" value={mailingAddress.postalCode || "—"} />
                </div>
              )
            ) : (
              <p className="text-muted-foreground text-sm">No mailing address recorded.</p>
            )}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="emergency" className="mt-0 space-y-5">
        <div className={panel}>
          <h3 className="text-foreground mb-4 text-base font-semibold">Primary Emergency Contact</h3>
          {primaryEmergencyContact ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field
                label="Name"
                value={
                  <div className="flex items-center gap-2">
                    <span>{primaryEmergencyContact.contactName}</span>
                    <StatusBadge tone="default">Primary contact</StatusBadge>
                  </div>
                }
              />
              <Field label="Relationship" value={primaryEmergencyContact.relationship || "—"} />
              <Field label="Mobile number" value={primaryEmergencyContact.mobileNumber || "—"} />
              <Field label="Alternative number" value={primaryEmergencyContact.alternativeNumber || "—"} />
              <Field label="Email" value={primaryEmergencyContact.email || "—"} />
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Address" value={primaryEmergencyContact.address || "—"} />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No emergency contact recorded.</p>
          )}
        </div>

        <div className={panel}>
          <h3 className="text-foreground mb-4 text-base font-semibold">Secondary Emergency Contact</h3>
          {secondaryEmergencyContact ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" value={secondaryEmergencyContact.contactName || "—"} />
              <Field label="Relationship" value={secondaryEmergencyContact.relationship || "—"} />
              <Field label="Mobile number" value={secondaryEmergencyContact.mobileNumber || "—"} />
              <Field label="Alternative number" value={secondaryEmergencyContact.alternativeNumber || "—"} />
              <Field label="Email" value={secondaryEmergencyContact.email || "—"} />
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Address" value={secondaryEmergencyContact.address || "—"} />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No secondary emergency contact recorded.</p>
          )}
        </div>

        <div className={panel}>
          <h3 className="text-foreground mb-4 text-base font-semibold">Next of Kin</h3>
          {nextOfKin ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" value={nextOfKin.contactName || "—"} />
              <Field label="Relationship" value={nextOfKin.relationship || "—"} />
              <Field label="Mobile number" value={nextOfKin.mobileNumber || "—"} />
              <Field label="Alternative number" value={nextOfKin.alternativeNumber || "—"} />
              <Field label="Email" value={nextOfKin.email || "—"} />
              <div className="sm:col-span-2 lg:col-span-3">
                <Field label="Address" value={nextOfKin.address || "—"} />
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No next of kin recorded.</p>
          )}
        </div>
      </TabsContent>

      <TabsContent value="employment" className="mt-0 space-y-5">
        <div className={panel}>
          <div className="mb-4 space-y-1">
            <h3 className="text-foreground text-base font-semibold">Position History</h3>
            <p className="text-muted-foreground text-sm">
              View the employee&apos;s most recent contract first, followed by previous contract positions.
            </p>
          </div>
          {sortedHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/10 px-4 py-8 text-center">
              <p className="text-foreground text-sm font-medium">No position history recorded.</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Position and contract history will appear here when contracts are added.
              </p>
            </div>
          ) : (
            <div className={cn("rounded-xl border border-border", shouldScrollHistory ? "max-h-[360px] overflow-y-auto" : "")}>
              <Table>
                <TableHeader className="bg-card">
                  <TableRow>
                    <TableHead>Minute #</TableHead>
                    <TableHead>Contract #</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHistory.map((row) => {
                    const contractStatusLabel = getContractDisplayStatus({
                      startDate: row.startDate,
                      endDate: row.endDate,
                      status: row.relatedContractStatus,
                    });
                    return (
                      <TableRow
                        key={row.pid}
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800"
                        onClick={() => router.push(`/contracts/${row.relatedContractId}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(`/contracts/${row.relatedContractId}`);
                          }
                        }}
                        role="link"
                        tabIndex={0}
                      >
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.relatedMinuteNumber?.trim() || "—"}
                        </TableCell>
                        <TableCell className="whitespace-normal text-sm font-medium">
                          <span>{row.relatedContractNumber?.trim() || "No assigned number"}</span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.startDate ? formatEmployeeDateDisplay(row.startDate) : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.endDate ? formatEmployeeDateDisplay(row.endDate) : "Present"}
                        </TableCell>
                        <TableCell className="max-w-[16rem] truncate text-sm">{row.department || "—"}</TableCell>
                        <TableCell className="max-w-[16rem] truncate text-sm">{row.position || "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <StatusBadge tone={getContractDisplayStatusTone(contractStatusLabel)}>
                            {contractStatusLabel}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className={panel}>
          <h3 className="text-foreground mb-4 text-base font-semibold">Right to Work / Immigration</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Work permit required"
              value={
                <StatusBadge tone={rightToWork?.workPermitRequired ? "warning" : "muted"}>
                  {rightToWork?.workPermitRequired ? "Work Permit Required" : "Not Required"}
                </StatusBadge>
              }
            />
            <Field label="Work permit number" value={rightToWork?.workPermitNumber || "—"} />
            <Field
              label="Work permit expiry date"
              value={
                rightToWork?.workPermitExpiryDate
                  ? formatEmployeeDateDisplay(rightToWork.workPermitExpiryDate)
                  : "—"
              }
            />
            <Field label="Immigration status" value={rightToWork?.immigrationStatus || "—"} />
            <Field label="Country of citizenship" value={rightToWork?.countryOfCitizenship || "—"} />
            <Field
              label="Right to work confirmed"
              value={
                <StatusBadge tone={rightToWork?.rightToWorkConfirmed ? "success" : "danger"}>
                  {rightToWork?.rightToWorkConfirmed ? "Right to Work Confirmed" : "Not Confirmed"}
                </StatusBadge>
              }
            />
            <Field
              label="Work permit status"
              value={
                <StatusBadge
                  tone={
                    permitStatus === "Expired"
                      ? "danger"
                      : permitStatus === "Expiring Soon" || permitStatus === "Required"
                        ? "warning"
                        : permitStatus === "Valid"
                          ? "success"
                          : "muted"
                  }
                >
                  {permitStatus === "Expiring Soon"
                    ? "Work Permit Expiring Soon"
                    : permitStatus === "Expired"
                      ? "Work Permit Expired"
                      : permitStatus === "Valid"
                        ? "Valid"
                        : permitStatus}
                </StatusBadge>
              }
            />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="documents" className={cn(panel, "mt-0")}>
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Qualifications are handled under documents together with certificates, IDs, permits, and contracts.
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Supported types: Qualification, Certificate, Transcript, Professional Certification, Licence, Resume / CV,
            National ID, Passport, Driver Permit, Work Permit, NIS, BIR, Contract, Other.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document name</TableHead>
                <TableHead>Document type</TableHead>
                <TableHead>Issue date</TableHead>
                <TableHead>Expiry date</TableHead>
                <TableHead>Uploaded date</TableHead>
                <TableHead>Status</TableHead>
                {allowMutations ? <TableHead>Action</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={allowMutations ? 7 : 6}
                    className="text-muted-foreground text-center"
                  >
                    No documents recorded.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((doc) => (
                  <TableRow key={doc.did}>
                    <TableCell className="whitespace-normal font-medium">{doc.documentName}</TableCell>
                    <TableCell>{doc.documentType}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {doc.issueDate ? formatEmployeeDateDisplay(doc.issueDate) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {doc.expiryDate ? formatEmployeeDateDisplay(doc.expiryDate) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatEmployeeDateDisplay(doc.uploadedAt)}
                    </TableCell>
                    <TableCell>{doc.status}</TableCell>
                    {allowMutations ? (
                      <TableCell>
                        <span className="text-muted-foreground text-xs">View (coming soon)</span>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="notes" className={cn(panel, "mt-0")}>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {employee.notes?.trim() || "No notes recorded."}
        </p>
      </TabsContent>
    </Tabs>
  );
}
