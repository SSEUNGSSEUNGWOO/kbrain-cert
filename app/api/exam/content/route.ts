import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";
import { loadExamContent } from "@/lib/exam/load-exam-content";

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (!sessionId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id, exam_id, submit_time")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session || session.submit_time) {
    return NextResponse.json({ error: "invalid session" }, { status: 403 });
  }

  const { data: exam } = await admin
    .from("exams")
    .select("exam_date, status, is_test_mode")
    .eq("id", session.exam_id)
    .single();
  if (!exam) {
    return NextResponse.json({ error: "exam not found" }, { status: 404 });
  }
  if (!exam.is_test_mode && exam.status !== "open") {
    return NextResponse.json({ error: "exam not open" }, { status: 403 });
  }
  if (exam.exam_date && new Date(exam.exam_date).getTime() > Date.now()) {
    return NextResponse.json(
      { error: "exam not started", startsAt: exam.exam_date },
      { status: 409 }
    );
  }

  const content = await loadExamContent(session.exam_id);
  return NextResponse.json(content, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
