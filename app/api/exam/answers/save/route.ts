import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

const MAX_BODY_BYTES = 1024 * 1024;

/**
 * 응시자 답안 auto-save
 * Body:
 * - auto-save: { sessionId, questionId, slotValues }
 * - submit 전 확정 저장: { sessionId, answers: [{ questionId, slotValues }] }
 * upsert by (session_id, question_id) · submit 전엔 submitted_at null
 */
export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "answer payload too large" }, { status: 413 });
  }
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

  const rows = isBulkSave
    ? answers.map((answer) => ({
        questionId: answer.questionId!,
        slotValues: answer.slotValues ?? {},
      }))
    : [
        {
          questionId: questionId!,
          slotValues: slotValues ?? {},
        },
      ];

  const admin = createAdminSupabase();
  const { data: updatedAt, error } = await admin.rpc("save_exam_answers", {
    p_session_id: sessionId,
    p_answers: rows,
  });
  if (error) {
    if (error.message.includes("session not found")) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }
    if (error.message.includes("already submitted")) {
      return NextResponse.json({ error: "already submitted" }, { status: 409 });
    }
    if (error.message.includes("exam time expired")) {
      await admin.rpc("auto_submit_expired_sessions");
      return NextResponse.json({ error: "exam time expired" }, { status: 409 });
    }
    if (
      error.message.includes("invalid answers") ||
      error.message.includes("duplicate question") ||
      error.message.includes("question not in exam") ||
      error.message.includes("slot not in question")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    updatedAt,
  });
}
