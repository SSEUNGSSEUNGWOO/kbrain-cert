import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/**
 * 감독관 액션 · 하나의 엔드포인트로 3종 처리
 * Body: { action: 'force_submit' | 'extend_time', minutes?: number, reason?: string }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id: sessionId } = await params;
  const body = await _request.json().catch(() => null);
  const { action, minutes, reason } = (body ?? {}) as {
    action?: "force_submit" | "extend_time" | "ack_alerts";
    minutes?: number;
    reason?: string;
  };
  if (!action) {
    return NextResponse.json({ error: "action required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id, status, submit_time, time_extension_minutes")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const nowIso = new Date().toISOString();

  if (action === "force_submit") {
    if (session.submit_time) {
      return NextResponse.json({ ok: true, alreadySubmitted: true });
    }
    await admin
      .from("exam_sessions")
      .update({
        status: "submitted",
        submit_time: nowIso,
        auto_submitted: false,
        monitoring_notes: reason ? `[force_submit] ${reason}` : "[force_submit]",
      })
      .eq("id", sessionId);
    await admin
      .from("answers")
      .update({ submitted_at: nowIso })
      .eq("session_id", sessionId)
      .is("submitted_at", null);
    await admin.from("session_messages").insert({
      session_id: sessionId,
      sender_role: "system",
      content: reason
        ? `감독관이 시험을 강제 종료했습니다: ${reason}`
        : "감독관이 시험을 강제 종료했습니다.",
    });
    return NextResponse.json({ ok: true, submittedAt: nowIso });
  }

  if (action === "extend_time") {
    const n = Number(minutes);
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      return NextResponse.json(
        { error: "minutes must be 1..120" },
        { status: 400 }
      );
    }
    if (session.submit_time) {
      return NextResponse.json({ error: "already submitted" }, { status: 400 });
    }
    const next = (session.time_extension_minutes ?? 0) + n;
    await admin
      .from("exam_sessions")
      .update({ time_extension_minutes: next, updated_at: nowIso })
      .eq("id", sessionId);
    await admin.from("session_messages").insert({
      session_id: sessionId,
      sender_role: "system",
      content: `감독관이 시험 시간을 ${n}분 연장했습니다 (누적 +${next}분).`,
    });
    return NextResponse.json({ ok: true, timeExtensionMinutes: next });
  }

  if (action === "ack_alerts") {
    // 감독관 확인 처리 · 이 시각 이전 high 이벤트는 주목 필요 판정에서 제외
    // is_flagged 해제 → 이후 새 이탈/부정 이벤트가 오면 DB 트리거가 다시 flag
    await admin
      .from("exam_sessions")
      .update({ monitor_acked_at: nowIso, is_flagged: false, updated_at: nowIso })
      .eq("id", sessionId);
    return NextResponse.json({ ok: true, ackedAt: nowIso });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
