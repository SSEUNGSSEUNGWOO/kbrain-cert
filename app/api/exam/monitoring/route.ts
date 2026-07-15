import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

/**
 * 감독 이벤트 배치 저장 · 클라이언트가 5초 window로 모아서 POST
 * Body: { sessionId, events: [{ eventType, severity, questionIndex?, payload? }] }
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
  const { sessionId, events } = (body ?? {}) as {
    sessionId?: string;
    events?: Array<{
      eventType: string;
      severity?: "info" | "warn" | "high";
      questionIndex?: number | null;
      payload?: Record<string, unknown>;
    }>;
  };
  if (!sessionId || cookieSessionId !== sessionId) {
    return NextResponse.json({ error: "session mismatch" }, { status: 403 });
  }
  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ ok: true, saved: 0 });
  }
  if (events.length > 100) {
    return NextResponse.json({ error: "too many events" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const rows = events.map((e) => ({
    session_id: sessionId,
    event_type: String(e.eventType).slice(0, 64),
    severity: (e.severity ?? "info") as "info" | "warn" | "high",
    question_index: e.questionIndex ?? null,
    payload: e.payload ?? null,
  }));

  const { error } = await admin.from("monitoring_events").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // high severity 이벤트가 있으면 세션에 is_flagged 마킹
  if (rows.some((r) => r.severity === "high")) {
    await admin
      .from("exam_sessions")
      .update({ is_flagged: true, updated_at: new Date().toISOString() })
      .eq("id", sessionId);
  }

  return NextResponse.json({ ok: true, saved: rows.length });
}
