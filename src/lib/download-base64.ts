import { EXCEL_MIME_TYPE } from "@/lib/export/excel-style";

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

/** Strip data-URL prefix and whitespace from a base64 payload. */
export function normalizeBase64Payload(base64: string): string {
  const trimmed = base64.trim();
  const dataUrlMatch = trimmed.match(/^data:[^;]+;base64,(.+)$/i);
  return (dataUrlMatch?.[1] ?? trimmed).replace(/\s/g, "");
}

export type Base64ToBytesOptions = {
  /** When true (default), reject payloads that are not valid base64 alphabet. */
  validate?: boolean;
};

/** Decode base64 to bytes without double-decoding an already-binary payload. */
export function base64ToUint8Array(
  base64: string,
  options: Base64ToBytesOptions = {},
): Uint8Array {
  const normalized = normalizeBase64Payload(base64);
  const shouldValidate = options.validate ?? true;

  if (shouldValidate && normalized.length > 0 && !BASE64_PATTERN.test(normalized)) {
    throw new Error("Invalid base64 payload");
  }

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function downloadBase64File(
  base64: string,
  fileName: string,
  mimeType: string = EXCEL_MIME_TYPE,
  options: Base64ToBytesOptions = {},
): void {
  const bytes = base64ToUint8Array(base64, options);
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
