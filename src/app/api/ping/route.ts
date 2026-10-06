import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Keep-alive endpoint. Hit daily by Vercel Cron (see vercel.json) so Supabase
// registers the project as active and doesn't auto-pause the free-tier DB.
// A single lightweight SELECT is enough to tick their activity meter.
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("tournaments").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
