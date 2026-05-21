import AdmZip from "adm-zip";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildNoteMonitorIndividualWorkbook,
  buildNoteMonitorReportWorkbook,
  isValidXlsxBase64,
  workbookToBase64,
} from "./note-monitor-export";
import type {
  NoteMonitorIndividualExportRecord,
  NoteMonitorReportRow,
} from "./note-monitor-reports";

const sampleRow: NoteMonitorReportRow = {
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

const sampleRecord: NoteMonitorIndividualExportRecord = {
  displayReference: "42/2026",
  noteType: "Authority Note",
  noteYear: 2026,
  noteNumber: 42,
  notePreparationDate: "2026-01-15",
  details: "Individual note export validation.",
  dateReturnedFromSecretary: "2026-02-01",
  dateSentToExecutiveCouncil: "2026-02-10",
  dateReceivedFromExecutiveCouncil: "",
  dueDate: "2026-03-01",
  status: "confirmed",
  createdBy: "Admin User",
  createdDate: "Jan 15, 2026, 10:00 AM",
  lastUpdatedBy: "Admin User",
  lastUpdatedDate: "Feb 10, 2026, 2:30 PM",
  linkedContracts: [
    {
      employeeName: "Jane Doe",
      fileNumber: "123",
      contractNumber: "456",
      role: "authority",
      status: "active",
    },
  ],
  history: [
    {
      editedAt: "Feb 10, 2026, 2:30 PM",
      editedBy: "Admin User",
      action: "updated",
      field: "status",
      previousValue: "pending",
      newValue: "confirmed",
    },
  ],
};

function validateXlsxBase64(contentBase64: string, expectedDataMarker: string) {
  expect(contentBase64.length).toBeGreaterThan(100);

  const buffer = Buffer.from(contentBase64, "base64");
  expect(buffer.length).toBeGreaterThan(500);

  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().map((entry) => entry.entryName);
  expect(entries).toContain("xl/workbook.xml");
  expect(entries).toContain("xl/worksheets/sheet1.xml");

  const sheet1 = zip.readAsText("xl/worksheets/sheet1.xml");
  expect(sheet1).toContain("<worksheet");
  expect(sheet1).toContain("<sheetData>");
  expect(sheet1).toContain("<row ");
  expect(sheet1).toContain(expectedDataMarker);
  expect(sheet1).not.toMatch(/<sheetViews>\s*<pane/);
  expect(sheet1).not.toContain("<autoFilter");
}

describe("note-monitor-export", () => {
  it("report export produces xlsx zip with data rows", () => {
    const workbook = buildNoteMonitorReportWorkbook({
      rows: [sampleRow],
      filters: { year: 2026 },
      generatedAt: "May 20, 2026, 12:00:00 PM",
      generatedBy: "Test User",
    });
    const contentBase64 = workbookToBase64(workbook);
    expect(isValidXlsxBase64(contentBase64)).toBe(true);
    validateXlsxBase64(contentBase64, "42/2026");
  });

  it("individual note export produces xlsx zip with data rows", () => {
    const workbook = buildNoteMonitorIndividualWorkbook({
      record: sampleRecord,
      generatedAt: "May 20, 2026, 12:00:00 PM",
      generatedBy: "Test User",
    });
    const contentBase64 = workbookToBase64(workbook);
    expect(isValidXlsxBase64(contentBase64)).toBe(true);
    validateXlsxBase64(contentBase64, "42/2026");
  });

  it("report export with empty rows still produces valid xlsx", () => {
    const workbook = buildNoteMonitorReportWorkbook({
      rows: [],
      filters: { year: 2026 },
      generatedAt: "May 20, 2026, 12:00:00 PM",
      generatedBy: "Test User",
    });
    const contentBase64 = workbookToBase64(workbook);
    validateXlsxBase64(contentBase64, "No records found");
  });

  it("report export uses 16 data columns", () => {
    const workbook = buildNoteMonitorReportWorkbook({
      rows: [sampleRow],
      filters: { year: 2026 },
      generatedAt: "May 20, 2026, 12:00:00 PM",
      generatedBy: "Test User",
    });
    const contentBase64 = workbookToBase64(workbook);
    const buffer = Buffer.from(contentBase64, "base64");
    const zip = new AdmZip(buffer);
    const sheet1 = zip.readAsText("xl/worksheets/sheet1.xml");
    expect(sheet1).toContain("Full Note Reference");
    expect(sheet1).toContain("Last Updated Date");
    expect(sheet1).toContain("Date Received from Executive Council");
  });

  it("sanitizes illegal XML characters in details", () => {
    const workbook = buildNoteMonitorReportWorkbook({
      rows: [{ ...sampleRow, details: "Note\x00with\x07controls" }],
      filters: { year: 2026 },
      generatedAt: "May 20, 2026, 12:00:00 PM",
      generatedBy: "Test User",
    });
    const contentBase64 = workbookToBase64(workbook);
    validateXlsxBase64(contentBase64, "Notewithcontrols");
  });
});
