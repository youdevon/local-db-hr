import AdmZip from "adm-zip";
import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildStyledWorkbook } from "@/lib/export/excel-export";
import type { AuditExcelRow } from "@/lib/export/excel-style";
import { writeStyledWorkbookBytesForDownload } from "@/lib/export/excel-export-client";
import { workbookToBase64 as serverWorkbookToBase64 } from "@/lib/export/excel-export-server";
import {
  buildNoteMonitorReportWorkbook,
  workbookToBase64 as noteMonitorWorkbookToBase64,
} from "@/lib/server/note-monitor-export";
import type { NoteMonitorReportRow } from "@/lib/server/note-monitor-reports";

const OUT_DIR = path.join(process.cwd(), "tmp/excel-validation");

const sampleNoteRow: NoteMonitorReportRow = {
  noteYear: 2026,
  noteNumber: 42,
  displayReference: "42/2026",
  noteType: "Authority Note",
  notePreparationDate: "2026-01-15",
  details: "Sample note details for export validation.",
  dateReturnedFromSecretary: "2026-02-01",
  dateSentToExecutiveCouncil: "2026-02-10",
  dateReceivedFromExecutiveCouncil: "",
  dueDate: "2026-03-01",
  status: "confirmed",
  linkedContracts: "Jane Doe · File #123 · Contract #456 (Authority Note) · active",
  createdBy: "Admin User",
  createdDate: "Jan 15, 2026, 10:00 AM",
  lastUpdatedBy: "Admin User",
  lastUpdatedDate: "Feb 10, 2026, 2:30 PM",
};

const sampleReportRow = {
  fileNumber: "1001",
  firstName: "Jane",
  lastName: "Doe",
  department: "Finance",
};

const sampleAuditRow: AuditExcelRow = {
  "Date / Time": "May 21, 2026, 10:00 AM",
  "Audit Type": "Data",
  "Who Attempted It": "Admin User",
  Action: "export",
  Target: "Employee Directory",
  Summary: "Exported 1 row",
  Module: "Reports",
  Success: "Yes",
  "Failure Reason": "",
  "IP Address": "127.0.0.1",
  "Device Name": "workstation-01",
};

function validateXlsxBuffer(buffer: Buffer, expectedMarker?: string) {
  expect(buffer.length).toBeGreaterThan(500);
  expect(buffer[0]).toBe(0x50);
  expect(buffer[1]).toBe(0x4b);

  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().map((entry) => entry.entryName);
  expect(entries).toContain("xl/workbook.xml");
  expect(entries).toContain("xl/worksheets/sheet1.xml");

  const sheet1 = zip.readAsText("xl/worksheets/sheet1.xml");
  expect(sheet1).toContain("<worksheet");
  expect(sheet1).toContain("<sheetData>");

  if (expectedMarker) {
    expect(sheet1).toContain(expectedMarker);
  }

  expect(sheet1).not.toMatch(/<sheetViews>\s*<pane/);

  if (sheet1.includes("<pane")) {
    expect(sheet1).toMatch(/<sheetView[^>]*>\s*<pane/);
  }

  return sheet1;
}

function writeSample(label: string, buffer: Buffer) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const safeName = label.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  fs.writeFileSync(path.join(OUT_DIR, `${safeName}.xlsx`), buffer);
}

function buildReportWorkbook(rows: Array<Record<string, string>>) {
  return buildStyledWorkbook({
    sheetName: "Report",
    header: {
      title: "Employee Directory",
      generatedAt: "May 21, 2026, 12:00 PM",
      filtersUsed: { Department: "Finance" },
      totalRecords: rows.length,
    },
    columns: [
      { key: "fileNumber", header: "File #", width: 12 },
      { key: "firstName", header: "First Name", width: 16 },
      { key: "lastName", header: "Last Name", width: 16 },
      { key: "department", header: "Department", width: 18 },
    ],
    rows,
    emptyMessage: "No records found for the selected filters.",
  });
}

function buildAuditWorkbook(rows: AuditExcelRow[]) {
  return buildStyledWorkbook({
    sheetName: "Audit Trail",
    header: {
      title: "Audit Trail Export",
      generatedAt: "May 21, 2026, 12:00 PM",
      filtersUsed: "None",
      totalRecords: rows.length,
    },
    columns: [
      { key: "Date / Time", header: "Date / Time", width: 22 },
      { key: "Audit Type", header: "Audit Type", width: 14, align: "center" },
      { key: "Who Attempted It", header: "Who Attempted It", width: 24 },
      { key: "Action", header: "Action", width: 20 },
      { key: "Target", header: "Target", width: 28, isLongText: true, wrapText: true },
      { key: "Summary", header: "Summary", isLongText: true, wrapText: true },
      { key: "Module", header: "Module", width: 18 },
      { key: "Success", header: "Success", width: 12, isStatus: true },
      { key: "Failure Reason", header: "Failure Reason", isLongText: true, wrapText: true },
      { key: "IP Address", header: "IP Address", width: 16, align: "center" },
      { key: "Device Name", header: "Device Name", width: 24, wrapText: true },
    ],
    rows,
    emptyMessage: "No audit records match the selected filters.",
  });
}

describe("excel-export-validation samples", () => {
  it("buildNoteMonitorReportWorkbook empty + one row (server-patched)", () => {
    for (const [label, rows, marker] of [
      ["note-monitor-empty", [] as NoteMonitorReportRow[], "No records found"],
      ["note-monitor-one-row", [sampleNoteRow], "42/2026"],
    ] as const) {
      const workbook = buildNoteMonitorReportWorkbook({
        rows,
        filters: { year: 2026 },
        generatedAt: "May 21, 2026, 12:00 PM",
        generatedBy: "Validation",
      });
      const buffer = Buffer.from(noteMonitorWorkbookToBase64(workbook), "base64");
      validateXlsxBuffer(buffer, marker);
      writeSample(label, buffer);
    }
  });

  it("exportReportToExcel equivalent — client patched download path", () => {
    for (const [label, rows, marker] of [
      ["report-client-empty", [], "No records found"],
      ["report-client-one-row", [sampleReportRow], "Jane"],
    ] as const) {
      const workbook = buildReportWorkbook(rows as Array<Record<string, string>>);
      const buffer = Buffer.from(writeStyledWorkbookBytesForDownload(workbook));
      validateXlsxBuffer(buffer, marker);
      writeSample(label, buffer);
    }
  });

  it("exportReportToExcel equivalent — server-patched path", () => {
    for (const [label, rows, marker] of [
      ["report-server-empty", [], "No records found"],
      ["report-server-one-row", [sampleReportRow], "Jane"],
    ] as const) {
      const workbook = buildReportWorkbook(rows as Array<Record<string, string>>);
      const buffer = Buffer.from(serverWorkbookToBase64(workbook), "base64");
      validateXlsxBuffer(buffer, marker);
      writeSample(label, buffer);
    }
  });

  it("exportAuditTrailToExcel equivalent — client patched download path", () => {
    for (const [label, rows, marker] of [
      ["audit-client-empty", [] as AuditExcelRow[], "No audit records"],
      ["audit-client-one-row", [sampleAuditRow], "Admin User"],
    ] as const) {
      const workbook = buildAuditWorkbook(rows);
      const buffer = Buffer.from(writeStyledWorkbookBytesForDownload(workbook));
      validateXlsxBuffer(buffer, marker);
      writeSample(label, buffer);
    }
  });

  it("exportAuditTrailToExcel equivalent — server-patched path", () => {
    for (const [label, rows, marker] of [
      ["audit-server-empty", [] as AuditExcelRow[], "No audit records"],
      ["audit-server-one-row", [sampleAuditRow], "Admin User"],
    ] as const) {
      const workbook = buildAuditWorkbook(rows);
      const buffer = Buffer.from(serverWorkbookToBase64(workbook), "base64");
      validateXlsxBuffer(buffer, marker);
      writeSample(label, buffer);
    }
  });
});
