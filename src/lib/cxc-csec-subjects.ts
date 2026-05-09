/** Single source for CXC / CSEC subject pickers and server-side validation */

export const CXC_CSEC_SUBJECT_OPTIONS = [
  "Additional Mathematics",
  "Agricultural Science",
  "Biology",
  "Caribbean History",
  "Certificate in Business Studies",
  "Chemistry",
  "Economics",
  "Electronic Document Preparation and Management (EDPM)",
  "English",
  "Geography",
  "Home Economics",
  "Human and Social Biology",
  "Industrial Technology",
  "Information Technology",
  "Integrated Science",
  "Mathematics",
  "Mechanical Engineering Technology",
  "Modern Languages",
  "Music",
  "Office Administration",
  "Physical Education and Sport",
  "Physics",
  "Principles of Accounts",
  "Principles of Business",
  "Religious Education",
  "Social Studies",
  "Technical Drawing",
  "Theatre Arts",
  "Visual Arts",
] as const;

export const CXC_CSEC_SUBJECT_SET = new Set<string>(CXC_CSEC_SUBJECT_OPTIONS);

export const CXC_CSEC_GRADE_OPTIONS = ["I", "II", "III"] as const;

export type CxcCsecGrade = (typeof CXC_CSEC_GRADE_OPTIONS)[number];
