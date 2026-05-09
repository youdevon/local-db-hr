/** Shared shape for employee self-service personal/contact fields (profile UI + server). */
export type ProfilePersonalInfoFields = {
  mobileNumber: string;
  homeNumber: string;
  personalEmail: string;
  addressLine1: string;
  addressLine2: string;
  communityCity: string;
  regionMunicipality: string;
  country: string;
  postalCode: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactMobileNumber: string;
  emergencyContactAlternativeNumber: string;
  emergencyContactEmail: string;
  emergencyContactAddress: string;
  nextOfKinFullName: string;
  nextOfKinRelationship: string;
  nextOfKinMobileNumber: string;
  nextOfKinAlternativeNumber: string;
  nextOfKinEmail: string;
  nextOfKinAddress: string;
};
