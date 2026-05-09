import { SectionCard } from "@/components/section-card";
import type { ProfilePersonalInfoFields } from "@/lib/types/profile-personal-info";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-foreground text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

type Props = {
  fullName: string;
  fileNumber: string;
  workEmail: string;
  userEmail: string;
  department: string;
  position: string;
  accountRole: string;
  personal: ProfilePersonalInfoFields;
};

export function ProfilePersonalInformationTab({
  fullName,
  fileNumber,
  workEmail,
  userEmail,
  department,
  position,
  accountRole,
  personal,
}: Props) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        Use <strong>Update Personal Information</strong> in the header to change contact details, address, next of kin, and
        emergency contact. Name, employee number, job details, and role are read-only.
      </p>

      <SectionCard title="Personal details (read-only)">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Full name" value={fullName} />
          <Field label="Employee number" value={fileNumber} />
          <Field label="Position" value={position} />
          <Field label="Department" value={department} />
          <Field label="Work email" value={workEmail} />
          <Field label="Account email" value={userEmail} />
          <Field label="System role" value={accountRole} />
        </dl>
      </SectionCard>

      <SectionCard title="Contact information">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Primary phone" value={personal.mobileNumber} />
          <Field label="Secondary phone" value={personal.homeNumber} />
          <Field label="Personal email" value={personal.personalEmail} />
        </dl>
      </SectionCard>

      <SectionCard title="Address">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Address line 1" value={personal.addressLine1} />
          <Field label="Address line 2" value={personal.addressLine2} />
          <Field label="City / community" value={personal.communityCity} />
          <Field label="Region / municipality" value={personal.regionMunicipality} />
          <Field label="Country" value={personal.country} />
          <Field label="Postal code" value={personal.postalCode} />
        </dl>
      </SectionCard>

      <SectionCard title="Next of kin">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" value={personal.nextOfKinFullName} />
          <Field label="Relationship" value={personal.nextOfKinRelationship} />
          <Field label="Phone" value={personal.nextOfKinMobileNumber} />
          <Field label="Alternate phone" value={personal.nextOfKinAlternativeNumber} />
          <Field label="Email" value={personal.nextOfKinEmail} />
          <Field label="Address" value={personal.nextOfKinAddress} />
        </dl>
      </SectionCard>

      <SectionCard title="Emergency contact">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" value={personal.emergencyContactName} />
          <Field label="Relationship" value={personal.emergencyContactRelationship} />
          <Field label="Phone" value={personal.emergencyContactMobileNumber} />
          <Field label="Alternate phone" value={personal.emergencyContactAlternativeNumber} />
          <Field label="Email" value={personal.emergencyContactEmail} />
          <Field label="Address" value={personal.emergencyContactAddress} />
        </dl>
      </SectionCard>
    </div>
  );
}
