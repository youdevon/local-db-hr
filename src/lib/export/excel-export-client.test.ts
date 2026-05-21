import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";

import { buildStyledWorkbook } from "@/lib/export/excel-export";
import { writeStyledWorkbookBytesForDownload } from "@/lib/export/excel-export-client";
import { cleanExcelValue } from "@/lib/export/excel-sanitize";

const employeeDirectoryRow = {
  fileNumber: "1001",
  firstName: "Jane",
  lastName: "Doe",
  department: "Finance",
  position: "Analyst",
  gender: "Female",
  dateOfBirth: "1990-01-15",
  age: 36,
  nationality: "Trinidad and Tobago",
  workEmail: "jane.doe@example.com",
  mobileNumber: "868-555-0100",
};

const employeeColumns = [
  { key: "fileNumber", label: "File #", type: "text" },
  { key: "firstName", label: "First Name", type: "text" },
  { key: "lastName", label: "Last Name", type: "text" },
  { key: "department", label: "Department", type: "text" },
  { key: "position", label: "Position", type: "text" },
  { key: "gender", label: "Gender", type: "text" },
  { key: "dateOfBirth", label: "Date of Birth", type: "date" },
  { key: "age", label: "Age", type: "number" },
  { key: "nationality", label: "Nationality", type: "text" },
  { key: "workEmail", label: "Work Email", type: "text" },
  { key: "mobileNumber", label: "Mobile Number", type: "text" },
];

function validateXlsxBytes(bytes: Uint8Array, expectedMarker: string) {
  expect(bytes.length).toBeGreaterThan(500);
  expect(bytes[0]).toBe(0x50);
  expect(bytes[1]).toBe(0x4b);

  const zip = new AdmZip(Buffer.from(bytes));
  const entries = zip.getEntries().map((entry) => entry.entryName);
  expect(entries).toContain("xl/workbook.xml");
  expect(entries).toContain("xl/worksheets/sheet1.xml");

  const sheet1 = zip.readAsText("xl/worksheets/sheet1.xml");
  expect(sheet1).toContain("<worksheet");
  expect(sheet1).toContain("<sheetData>");
  expect(sheet1).toContain(expectedMarker);
  expect(sheet1).not.toMatch(/<sheetViews>\s*<pane/);

  return sheet1;
}

describe("excel-export-client", () => {
  it("employee directory styled export produces valid xlsx bytes", () => {
    const workbook = buildStyledWorkbook({
      sheetName: "Report",
      header: {
        title: "Employee Directory",
        generatedAt: "May 21, 2026, 12:00 PM",
        filtersUsed: "None",
        totalRecords: 1,
      },
      columns: employeeColumns.map((column) => ({
        key: column.key,
        header: column.label,
        isDate: column.type === "date",
        align: column.type === "number" ? ("right" as const) : ("left" as const),
      })),
      rows: [
        {
          ...employeeDirectoryRow,
          firstName: cleanExcelValue("Jane\x00"),
        },
      ],
    });

    const bytes = writeStyledWorkbookBytesForDownload(workbook);
    const sheet1 = validateXlsxBytes(bytes, "Jane");
    expect(sheet1).not.toContain("\x00");
  });

  it("exportReportToExcel row prep drops uuid columns and masks uuid cell values", () => {
    const columns = [{ key: "employeeId", label: "Employee ID", type: "text" }, ...employeeColumns];
    const exportColumns = columns.filter((column) => !/^(id|.*Id|.*_id|uuid)$/i.test(column.key));

    const row = {
      ...employeeDirectoryRow,
      employeeId: "550e8400-e29b-41d4-a716-446655440000",
      firstName: "Jane\x00",
    };

    const sanitizedRow = Object.fromEntries(
      exportColumns.map((column) => [
        column.key,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(row[column.key as keyof typeof row] ?? ""))
          ? "—"
          : cleanExcelValue(row[column.key as keyof typeof row], { emptyDisplay: "—" }),
      ]),
    );

    expect(exportColumns.some((column) => column.key === "employeeId")).toBe(false);
    expect(sanitizedRow.firstName).toBe("Jane");
    expect(sanitizedRow).not.toHaveProperty("employeeId");
  });
});
