import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 시험 최종 제출
 * Body: { sessionId, auto?: boolean }
 * - exam_sessions.status → 'submitted', submit_time = NOW
 * - 모든 answers.submitted_at = NOW
 * - auto=true면 타이머 만료 자동 제출로 표시 (auto_submitted=true)
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
  const { sessionId, auto } = (body ?? {}) as {
    sessionId?: string;
    auto?: boolean;
  };
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  if (cookieSessionId !== sessionId) {
    return NextResponse.json({ error: "session mismatch" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id, status, submit_time")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.submit_time || session.status === "submitted") {
    return NextResponse.json({ ok: true, alreadySubmitted: true });
  }

  const nowIso = new Date().toISOString();
  const { error: sessionErr } = await admin
    .from("exam_sessions")
    .update({
      status: "submitted",
      submit_time: nowIso,
      auto_submitted: !!auto,
    })
    .eq("id", sessionId);
  if (sessionErr) {
    return NextResponse.json({ error: sessionErr.message }, { status: 500 });
  }

  await admin
    .from("answers")
    .update({ submitted_at: nowIso })
    .eq("session_id", sessionId)
    .is("submitted_at", null);

  return NextResponse.json({ ok: true, submittedAt: nowIso });
}
