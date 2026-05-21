import AdmZip from "adm-zip";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildStyledWorkbook } from "@/lib/export/excel-export";
import { workbookToBase64 } from "@/lib/export/excel-export-server";

describe("excel-export-server", () => {
  it("workbookToBase64 returns decodable XLSX zip bytes", () => {
    const workbook = buildStyledWorkbook({
      sheetName: "Export Test",
      header: {
        title: "Server Export",
        generatedAt: "May 21, 2026",
        totalRecords: 1,
      },
      columns: [{ key: "name", header: "Name" }],
      rows: [{ name: "Alice" }],
    });

    const contentBase64 = workbookToBase64(workbook);
    expect(contentBase64.length).toBeGreaterThan(100);

    const buffer = Buffer.from(contentBase64, "base64");
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    const zip = new AdmZip(buffer);
    const sheet1 = zip.readAsText("xl/worksheets/sheet1.xml");
    expect(sheet1).toContain("Alice");
  });
});
