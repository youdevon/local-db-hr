export type ManagedUserRow = {
  id: string;
  email: string;
  fullName: string;
  initials: string | null;
  role: string;
  department: string | null;
  employeeId: string | null;
  linkedEmployeeName: string | null;
  linkedEmployeeFileNumber: string | null;
  linkedEmployeeDepartment: string | null;
  linkedEmployeePosition: string | null;
  isActive: boolean;
  isLocked: boolean;
  lastLoginAt: string | null;
};

export type ManagedEmployeeOption = {
  id: string;
  fullName: string;
  fileNumber: string;
  mobileNumber: string;
  homeNumber: string;
  workEmail: string;
  personalEmail: string;
  position: string;
  department: string;
  attachedUserId: string | null;
  searchText: string;
};
