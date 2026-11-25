import { NextResponse } from "next/server";
import { getLiveStats } from "@/lib/stats";

// Thin JSON wrapper around getLiveStats so the numbers are also debuggable
// via a curl / fetch call. The landing page itself reads the same helper
// server-side so its first HTML paint already has real numbers baked in —
// no flash of "—" placeholders.
export const revalidate = 60;

export async function GET() {
  return NextResponse.json(await getLiveStats());
}
