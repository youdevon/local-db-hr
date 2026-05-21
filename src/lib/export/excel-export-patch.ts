import "server-only";

export type XlsxSheetPatch = {
  sheetPath: string;
  freezeRow1Based?: number;
  landscape?: boolean;
  printTitleRow1Based?: number;
  sheetName?: string;
};

function toBuffer(input: Buffer | Uint8Array): Buffer {
  return Buffer.isBuffer(input) ? input : Buffer.from(input);
}

/** Insert freeze pane inside sheetView (OOXML requires pane as child of sheetView, not sheetViews). */
export function injectFreezePane(xml: string, freezeRow1Based: number): string {
  if (freezeRow1Based <= 0) return xml;

  const ySplit = freezeRow1Based;
  const topLeftCell = `A${ySplit + 1}`;
  const paneTag = `<pane xSplit="0" ySplit="${ySplit}" topLeftCell="${topLeftCell}" activePane="bottomLeft" state="frozen"/>`;
  const selectionTag = `<selection pane="bottomLeft" activeCell="${topLeftCell}" sqref="${topLeftCell}"/>`;
  const freezeBlock = `${paneTag}${selectionTag}`;

  if (/<sheetView[^>]*\/>/.test(xml)) {
    return xml.replace(/<sheetView([^/]*)\/>/, `<sheetView$1>${freezeBlock}</sheetView>`);
  }

  const sheetViewPattern = /<sheetView([^>]*)>([\s\S]*?)<\/sheetView>/;
  const match = xml.match(sheetViewPattern);
  if (!match) return xml;

  const [, attrs, inner] = match;
  const cleanedInner = inner
    .replace(/<pane[^>]*\/>/g, "")
    .replace(/<selection[^>]*\/>/g, "");
  const replacement = `<sheetView${attrs}>${cleanedInner}${freezeBlock}</sheetView>`;
  return xml.replace(sheetViewPattern, replacement);
}

/** Temporarily disabled — AdmZip XML injection was corrupting sheet1.xml. */
export function patchXlsxBytes(input: Buffer | Uint8Array, _patches: XlsxSheetPatch[]): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(toBuffer(input));
}
