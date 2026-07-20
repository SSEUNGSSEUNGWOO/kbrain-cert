import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";
import { getSessionDeadlineMs } from "@/lib/exam/deadline";

/**
 * 응시자용 세션 상태 조회 · 시간 연장 · 강제 종료 실시간 반영
 */
export async function GET() {
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (!cookieSessionId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select(
      "id, exam_id, status, start_time, submit_time, time_extension_minutes"
    )
    .eq("id", cookieSessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  const { data: exam } = await admin
    .from("exams")
    .select("exam_date, duration_minutes")
    .eq("id", session.exam_id)
    .single();
  if (!exam) {
    return NextResponse.json({ error: "exam not found" }, { status: 404 });
  }

  const serverNowMs = Date.now();
  const endsAtMs = getSessionDeadlineMs({
    examDate: exam.exam_date,
    startTime: session.start_time,
    durationMinutes: exam.duration_minutes,
    extensionMinutes: session.time_extension_minutes ?? 0,
  });
  let isSubmitted =
    !!session.submit_time || session.status === "submitted";

  if (!isSubmitted && endsAtMs != null && endsAtMs + 5_000 <= serverNowMs) {
    const submittedAt = new Date(serverNowMs).toISOString();
    await admin
      .from("exam_sessions")
      .update({
        status: "submitted",
        submit_time: submittedAt,
        auto_submitted: true,
        updated_at: submittedAt,
      })
      .eq("id", session.id)
      .is("submit_time", null);
    await admin
      .from("answers")
      .update({ submitted_at: submittedAt })
      .eq("session_id", session.id)
      .is("submitted_at", null);
    isSubmitted = true;
  }

  return NextResponse.json({
    timeExtensionMinutes: session.time_extension_minutes ?? 0,
    isSubmitted,
    serverNow: new Date(serverNowMs).toISOString(),
    endsAt: endsAtMs == null ? null : new Date(endsAtMs).toISOString(),
  });
}
