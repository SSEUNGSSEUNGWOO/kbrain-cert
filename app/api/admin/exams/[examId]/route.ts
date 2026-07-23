import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/**
 * 시험 부분 편집 (관리자 전용)
 * Body: { examDate?, durationMinutes?, status?, maxParticipants?, slug? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminSupabase();
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { examId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length === 0 || title.length > 200) {
      return NextResponse.json(
        { error: "title must be 1..200 chars" },
        { status: 400 }
      );
    }
    patch.title = title;
  }
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
  if ("slug" in body) {
    const slug = typeof body.slug === "string" ? body.slug.trim() : body.slug;
    if (
      slug !== null &&
      (typeof slug !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
        slug.length > 80)
    ) {
      return NextResponse.json({ error: "invalid slug" }, { status: 400 });
    }
    patch.slug = slug || null;
  }
  if ("isTestMode" in body) {
    if (typeof body.isTestMode !== "boolean") {
      return NextResponse.json(
        { error: "isTestMode must be boolean" },
        { status: 400 }
      );
    }
    patch.is_test_mode = body.isTestMode;
  }
  if ("allowNoScreenShare" in body) {
    if (typeof body.allowNoScreenShare !== "boolean") {
      return NextResponse.json(
        { error: "allowNoScreenShare must be boolean" },
        { status: 400 }
      );
    }
    patch.allow_no_screen_share = body.allowNoScreenShare;
  }
  if ("gradeId" in body) {
    if (body.gradeId !== null && typeof body.gradeId !== "string") {
      return NextResponse.json(
        { error: "gradeId must be a string or null" },
        { status: 400 }
      );
    }
    patch.grade_id = body.gradeId;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const { error } = await admin
    .from("exams")
    .update(patch)
    .eq("id", examId);
  if (error) {
    return NextResponse.json(
      { error: error.code === "23505" ? "slug already exists" : error.message },
      { status: error.code === "23505" ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
