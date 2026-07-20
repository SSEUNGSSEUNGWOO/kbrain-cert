import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 시험 최종 제출
 * Body: { sessionId, auto?: boolean, answers?: [{ questionId, slotValues }] }
 * 최종 답안 upsert와 세션 제출을 DB 트랜잭션 한 번으로 처리한다.
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
  const { sessionId, auto, answers } = (body ?? {}) as {
    sessionId?: string;
    auto?: boolean;
    answers?: Array<{
      questionId?: string;
      slotValues?: Record<string, unknown>;
    }>;
  };
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }
  if (cookieSessionId !== sessionId) {
    return NextResponse.json({ error: "session mismatch" }, { status: 403 });
  }
  if (
    answers != null &&
    (!Array.isArray(answers) ||
      answers.length > 500 ||
      answers.some((answer) => !answer.questionId))
  ) {
    return NextResponse.json({ error: "invalid answers" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data, error } = await admin.rpc("submit_exam_session", {
    p_session_id: sessionId,
    p_answers: (answers ?? []).map((answer) => ({
      questionId: answer.questionId,
      slotValues: answer.slotValues ?? {},
    })),
    p_auto: !!auto,
  });
  if (error) {
    if (error.message.includes("session not found")) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }
    if (error.message.includes("exam time expired")) {
      return NextResponse.json({ error: "exam time expired" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data?.[0];
  return NextResponse.json({
    ok: true,
    submittedAt: result?.submitted_at ?? null,
    alreadySubmitted: result?.already_submitted ?? false,
  });
}
