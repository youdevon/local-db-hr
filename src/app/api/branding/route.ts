import { NextResponse } from "next/server";

import {
  getBrandingSettings,
  resolveBrandDisplayName,
} from "@/lib/branding";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const settings = await getBrandingSettings();
  return NextResponse.json(
    {
      companyName: settings.companyName,
      displayName: resolveBrandDisplayName(settings),
      logoUrl: null,
      hasCustomLogo: false,
      updatedAt: settings.updatedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
  );
}
