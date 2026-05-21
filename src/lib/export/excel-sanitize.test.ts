import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { injectFreezePane } from "@/lib/export/excel-export-patch";
import { cleanExcelValue, safeCellValue, stripInvalidXmlChars } from "@/lib/export/excel-sanitize";

describe("excel-sanitize", () => {
  it("strips illegal XML control characters", () => {
    expect(stripInvalidXmlChars("hello\x00world\x07")).toBe("helloworld");
  });

  it("cleanExcelValue returns empty display for blank values", () => {
    expect(cleanExcelValue(null, { emptyDisplay: "—" })).toBe("—");
    expect(cleanExcelValue("  ", { emptyDisplay: "—" })).toBe("—");
  });

  it("cleanExcelValue preserves finite numbers", () => {
    expect(cleanExcelValue(42)).toBe(42);
    expect(cleanExcelValue(Number.NaN)).toBe("");
  });

  it("safeCellValue delegates to cleanExcelValue", () => {
    expect(safeCellValue("test\x01value")).toBe("testvalue");
  });
});

describe("injectFreezePane", () => {
  const baseXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetData/></worksheet>`;

  it("places pane inside sheetView, not sheetViews", () => {
    const patched = injectFreezePane(baseXml, 7);
    expect(patched).not.toMatch(/<sheetViews><pane/);
    expect(patched).toMatch(/<sheetView[^>]*><pane xSplit="0" ySplit="7"/);
    expect(patched).toContain('<selection pane="bottomLeft" activeCell="A8" sqref="A8"/>');
    expect(patched.match(/<pane /g)?.length).toBe(1);
  });

  it("replaces an existing pane in a single pass without duplicating pane tags", () => {
    const xmlWithPane = baseXml.replace(
      "<sheetView workbookViewId=\"0\"/>",
      '<sheetView workbookViewId="0"><pane xSplit="0" ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView>',
    );
    const patched = injectFreezePane(xmlWithPane, 7);
    expect(patched.match(/<pane /g)?.length).toBe(1);
    expect(patched).toContain('ySplit="7"');
    expect(patched).toContain('<selection pane="bottomLeft" activeCell="A8" sqref="A8"/>');
  });
});
