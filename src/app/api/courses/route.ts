import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Courses are a shared library — any commissioner can pick any course in
  // their tournament dropdown. owner_id stays as the "added by" attribution,
  // and edit/delete is still restricted to the original owner (or super-admin)
  // in PATCH/DELETE below.
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: false });

  // Annotate each row with whether the current user added it, for any UI
  // that wants to badge "yours" vs "shared".
  const annotated = (courses || []).map((c) => ({
    ...c,
    isOwn: c.owner_id === user.id,
  }));

  return NextResponse.json(annotated);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, numHoles, holes } = body;

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      owner_id: user.id,
      name,
      num_holes: numHoles || 18,
      holes: holes || [],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(course);
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, name, numHoles, holes } = body;

  // Owner or super-admin can edit; everyone else gets nothing.
  let query = supabase
    .from("courses")
    .update({
      name,
      num_holes: numHoles || 18,
      holes: holes || [],
    })
    .eq("id", id);
  if (!isSuperAdminEmail(user.email)) {
    query = query.eq("owner_id", user.id);
  }
  const { data: course, error } = await query.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(course);
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  let del = supabase.from("courses").delete().eq("id", Number(id));
  if (!isSuperAdminEmail(user.email)) {
    del = del.eq("owner_id", user.id);
  }
  await del;

  return NextResponse.json({ success: true });
}
