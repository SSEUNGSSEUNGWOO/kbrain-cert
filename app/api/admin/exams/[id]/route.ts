import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/**
 * 시험 부분 편집 (관리자 전용)
 * Body: { examDate?: string|null, durationMinutes?: number, status?: 'draft'|'open'|'closed', maxParticipants?: number|null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("examDate" in body) {
    patch.exam_date = body.examDate ?? null;
  }
  if ("durationMinutes" in body) {
    const n = Number(body.durationMinutes);
    if (!Number.isFinite(n) || n < 1 || n > 600) {
      return NextResponse.json(
        { error: "durationMinutes must be 1..600" },
        { status: 400 }
      );
    }
    patch.duration_minutes = n;
  }
  if ("status" in body) {
    if (!["draft", "open", "closed"].includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    patch.status = body.status;
  }
  if ("maxParticipants" in body) {
    patch.max_participants = body.maxParticipants ?? null;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { error } = await admin.from("exams").update(patch).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
