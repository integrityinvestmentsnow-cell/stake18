import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Keep-alive endpoint. Vercel Cron hits this every 6 hours (see vercel.json)
// to keep Supabase's dormancy detector happy on the free tier.
//
// A single daily anon SELECT was not enough — Supabase still flagged the
// project as inactive. This version does a real write (an UPDATE on the
// heartbeat row via service role) plus two reads across different tables,
// so the project shows live read + write I/O on the activity meter.
export async function GET() {
  const supabase = createServiceClient();

  const { error: writeErr } = await supabase
    .from("heartbeat")
    .update({ last_ping: new Date().toISOString() })
    .eq("id", 1);

  if (writeErr) {
    return NextResponse.json({ ok: false, step: "write", error: writeErr.message }, { status: 500 });
  }

  const [{ error: readErr1 }, { error: readErr2 }] = await Promise.all([
    supabase.from("tournaments").select("id").limit(1),
    supabase.from("scores").select("id").limit(1),
  ]);

  if (readErr1 || readErr2) {
    return NextResponse.json(
      { ok: false, step: "read", error: (readErr1 || readErr2)?.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, at: new Date().toISOString() });
}
