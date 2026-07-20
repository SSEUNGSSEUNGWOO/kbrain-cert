import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 응시자 답안 auto-save
 * Body:
 * - auto-save: { sessionId, questionId, slotValues }
 * - submit 전 확정 저장: { sessionId, answers: [{ questionId, slotValues }] }
 * upsert by (session_id, question_id) · submit 전엔 submitted_at null
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (!cookieSessionId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { sessionId, questionId, slotValues, answers } = (body ?? {}) as {
    sessionId?: string;
    questionId?: string;
    slotValues?: Record<string, unknown>;
    answers?: Array<{
      questionId?: string;
      slotValues?: Record<string, unknown>;
    }>;
  };
  const isBulkSave = Array.isArray(answers);
  if (!sessionId || (!questionId && !isBulkSave)) {
    return NextResponse.json(
      { error: "sessionId and answer data required" },
      { status: 400 }
    );
  }
  if (
    isBulkSave &&
    (answers.length > 500 ||
      answers.some((answer) => !answer.questionId))
  ) {
    return NextResponse.json({ error: "invalid answers" }, { status: 400 });
  }
  if (cookieSessionId !== sessionId) {
    return NextResponse.json({ error: "session mismatch" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  // 세션이 이미 제출됐으면 저장 거부
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id, status, submit_time")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.submit_time || session.status === "submitted") {
    return NextResponse.json({ error: "already submitted" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const rows = isBulkSave
    ? answers.map((answer) => ({
        session_id: sessionId,
        question_id: answer.questionId!,
        slot_values: answer.slotValues ?? {},
        updated_at: nowIso,
      }))
    : [
        {
          session_id: sessionId,
          question_id: questionId!,
          slot_values: slotValues ?? {},
          updated_at: nowIso,
        },
      ];

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, updatedAt: nowIso });
  }

  const { error: upsertErr } = await admin
    .from("answers")
    .upsert(rows, { onConflict: "session_id,question_id" });
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // 최초 저장 시 status → in_progress + start_time 설정
  if (session.status === "waiting") {
    await admin
      .from("exam_sessions")
      .update({
        status: "in_progress",
        start_time: nowIso,
      })
      .eq("id", sessionId);
  }

  return NextResponse.json({ ok: true, updatedAt: nowIso });
}
