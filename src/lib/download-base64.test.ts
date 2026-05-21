import { describe, expect, it } from "vitest";

import {
  base64ToUint8Array,
  normalizeBase64Payload,
} from "@/lib/download-base64";
import { EXCEL_MIME_TYPE } from "@/lib/export/excel-style";

describe("download-base64", () => {
  it("normalizes data URLs and whitespace", () => {
    expect(normalizeBase64Payload("  data:text/plain;base64,QUJD  ")).toBe("QUJD");
  });

  it("decodes base64 to bytes once", () => {
    const bytes = base64ToUint8Array("QUJD");
    expect(Array.from(bytes)).toEqual([65, 66, 67]);
  });

  it("rejects invalid base64 when validation is enabled", () => {
    expect(() => base64ToUint8Array("not!!!base64")).toThrow("Invalid base64 payload");
  });

  it("uses the XLSX MIME constant", () => {
    expect(EXCEL_MIME_TYPE).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });
});
