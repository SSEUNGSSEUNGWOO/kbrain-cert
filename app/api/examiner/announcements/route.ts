import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: role } = await createAdminSupabase()
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "examiner"])
    .limit(1)
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { examId, content } = (body ?? {}) as {
    examId?: string;
    content?: string;
  };
  const trimmed = (content ?? "").trim();
  if (!examId || !trimmed || trimmed.length > 500) {
    return NextResponse.json(
      { error: "examId and content required (1..500)" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: exam } = await admin
    .from("exams")
    .select("id")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) {
    return NextResponse.json({ error: "exam not found" }, { status: 404 });
  }

  const { data: sessions, error: sessionError } = await admin
    .from("exam_sessions")
    .select("id")
    .eq("exam_id", examId)
    .is("submit_time", null);
  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (!sessions?.length) {
    return NextResponse.json({ recipientCount: 0 });
  }

  const { error } = await admin.from("session_messages").insert(
    sessions.map((session) => ({
      session_id: session.id,
      sender_role: "examiner" as const,
      sender_id: user.id,
      content: trimmed,
      is_announcement: true,
    }))
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ recipientCount: sessions.length });
}
