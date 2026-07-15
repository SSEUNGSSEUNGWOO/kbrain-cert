import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * 응시 전 사전 점검 결과 저장 · 스텝별로 호출
 * A-a-i 정책: 실 시험(로그인 응시자)만 저장 · 각 스텝 완료 시 upsert · 마지막 스냅샷 유지
 *
 * Body: { sessionId, step: "env"|"pledge"|"waiting", data }
 *   - env:     { envResult: object · userAgent: string }
 *   - pledge:  { } (동의 시각을 서버에서 NOW()로 기록)
 *   - waiting: { } (대기실 진입 시각을 서버에서 NOW()로 기록)
 *
 * exam(시험 입장) 스텝은 별도 API(exam_sessions.start_time)로 처리
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { sessionId, step, data } = body as {
    sessionId?: string;
    step?: "env" | "pledge" | "waiting";
    data?: Record<string, unknown>;
  };
  if (!sessionId || !step) {
    return NextResponse.json(
      { error: "sessionId and step are required" },
      { status: 400 }
    );
  }

  // 응시자 본인 세션인지 확인
  const { data: session, error: findErr } = await supabase
    .from("exam_sessions")
    .select("id, applicant_id")
    .eq("id", sessionId)
    .single();
  if (findErr || !session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.applicant_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (step === "env") {
    patch.precheck_env_result = data?.envResult ?? null;
    if (typeof data?.userAgent === "string") {
      patch.precheck_user_agent = data.userAgent;
    }
  } else if (step === "pledge") {
    patch.precheck_pledge_accepted_at = new Date().toISOString();
  } else if (step === "waiting") {
    patch.precheck_waiting_entered_at = new Date().toISOString();
  } else {
    return NextResponse.json({ error: "unknown step" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("exam_sessions")
    .update(patch)
    .eq("id", sessionId);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, step });
}
