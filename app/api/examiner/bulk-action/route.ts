import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminSupabase();
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "examiner"])
    .limit(1)
    .maybeSingle();
  if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { examId, examTitle, reason } = (body ?? {}) as {
    examId?: string;
    examTitle?: string;
    reason?: string;
  };
  const trimmedReason = (reason ?? "").trim();
  if (!examId || !examTitle || trimmedReason.length < 5 || trimmedReason.length > 500) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const { data: exam } = await admin
    .from("exams")
    .select("id, title")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return NextResponse.json({ error: "exam not found" }, { status: 404 });
  if (examTitle !== exam.title) {
    return NextResponse.json({ error: "exam title mismatch" }, { status: 400 });
  }

  const { data: submittedCount, error } = await admin.rpc(
    "force_submit_exam_sessions",
    { p_exam_id: examId, p_reason: trimmedReason }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ submittedCount: submittedCount ?? 0 });
}
