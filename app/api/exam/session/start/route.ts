import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 시험 창 진입(대기실 → 시험창) 시 호출 · idempotent
 * - start_time이 이미 있으면 그대로 반환
 * - 없으면 서버 시각으로 설정 + status='in_progress'
 * Body: { sessionId }
 * Response: { startTime, durationMinutes }
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (!cookieSessionId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { sessionId } = (body ?? {}) as { sessionId?: string };
  if (!sessionId || cookieSessionId !== sessionId) {
    return NextResponse.json({ error: "session mismatch" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id, exam_id, start_time, submit_time, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.submit_time) {
    return NextResponse.json({ error: "already submitted" }, { status: 400 });
  }

  const { data: exam } = await admin
    .from("exams")
    .select("duration_minutes, exam_date")
    .eq("id", session.exam_id)
    .single();
  const durationMinutes = exam?.duration_minutes ?? 120;
  const serverNowMs = Date.now();
  if (exam?.exam_date && new Date(exam.exam_date).getTime() > serverNowMs) {
    return NextResponse.json(
      {
        error: "exam not started",
        startsAt: exam.exam_date,
        serverNow: new Date(serverNowMs).toISOString(),
      },
      { status: 409 }
    );
  }

  let startTime = session.start_time;
  if (!startTime) {
    const nowIso = new Date(serverNowMs).toISOString();
    const { error: updateErr } = await admin
      .from("exam_sessions")
      .update({ start_time: nowIso, status: "in_progress" })
      .eq("id", sessionId);
    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
    startTime = nowIso;
  }

  return NextResponse.json({
    startTime,
    durationMinutes,
    serverNow: new Date(serverNowMs).toISOString(),
  });
}
