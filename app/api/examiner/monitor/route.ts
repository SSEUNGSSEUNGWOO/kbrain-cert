import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/**
 * 감독관 실시간 모니터 데이터
 * 5초 폴링용 · 특정 exam의 진행 중 세션 + 최근 감독 이벤트
 * Query: ?examId=<uuid>
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = createAdminSupabase();
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "examiner"])
    .limit(1)
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const examId = searchParams.get("examId");
  if (!examId) {
    return NextResponse.json({ error: "examId required" }, { status: 400 });
  }

  // 진행 중 or 대기 중 세션 (제출 안 된 것들)
  const { data: sessions } = await admin
    .from("exam_sessions")
    .select(
      "id, status, start_time, submit_time, is_flagged, auto_submitted, invitation_id"
    )
    .eq("exam_id", examId)
    .is("submit_time", null)
    .order("start_time", { ascending: true, nullsFirst: true });

  const sessionIds = (sessions ?? []).map((s) => s.id);
  const invitationIds = Array.from(
    new Set((sessions ?? []).map((s) => s.invitation_id).filter(Boolean))
  ) as string[];

  const [
    { data: invitations },
    { data: recentEvents },
    { data: eventCounts },
    { data: unreadMessages },
  ] =
    await Promise.all([
      invitationIds.length
        ? admin
            .from("exam_invitations")
            .select("id, name, email, organization")
            .in("id", invitationIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; email: string; organization: string | null }> }),
      sessionIds.length
        ? admin
            .from("monitoring_events")
            .select(
              "id, session_id, event_type, severity, detected_at, question_index, payload"
            )
            .in("session_id", sessionIds)
            .order("detected_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as Array<{ id: number; session_id: string; event_type: string; severity: string; detected_at: string; question_index: number | null; payload: unknown }> }),
      sessionIds.length
        ? admin
            .from("monitoring_events")
            .select("session_id, severity")
            .in("session_id", sessionIds)
            .in("severity", ["warn", "high"])
            .order("detected_at", { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: [] as Array<{ session_id: string; severity: string }> }),
      sessionIds.length
        ? admin
            .from("session_messages")
            .select("id, session_id, content, created_at")
            .in("session_id", sessionIds)
            .eq("sender_role", "applicant")
            .is("read_at", null)
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [] as Array<{ id: number; session_id: string; content: string; created_at: string }> }),
    ]);

  const invMap: Record<
    string,
    { name: string | null; email: string; organization: string | null }
  > = {};
  for (const inv of invitations ?? []) {
    invMap[inv.id] = {
      name: inv.name,
      email: inv.email,
      organization: inv.organization,
    };
  }

  // 세션별 warningCount + lastEvent + last high severity
  const warnCount: Record<string, { high: number; warn: number }> = {};
  for (const e of eventCounts ?? []) {
    if (!warnCount[e.session_id])
      warnCount[e.session_id] = { high: 0, warn: 0 };
    if (e.severity === "high") warnCount[e.session_id].high += 1;
    else if (e.severity === "warn") warnCount[e.session_id].warn += 1;
  }

  const lastEventBySession: Record<
    string,
    { eventType: string; severity: string; detectedAt: string }
  > = {};
  for (const e of recentEvents ?? []) {
    if (!lastEventBySession[e.session_id]) {
      lastEventBySession[e.session_id] = {
        eventType: e.event_type,
        severity: e.severity,
        detectedAt: e.detected_at,
      };
    }
  }

  const unreadBySession: Record<
    string,
    { count: number; content: string; createdAt: string }
  > = {};
  for (const message of unreadMessages ?? []) {
    const current = unreadBySession[message.session_id];
    if (current) current.count += 1;
    else {
      unreadBySession[message.session_id] = {
        count: 1,
        content: message.content,
        createdAt: message.created_at,
      };
    }
  }

  const enrichedSessions = (sessions ?? []).map((s) => {
    const inv = s.invitation_id ? invMap[s.invitation_id] : null;
    const counts = warnCount[s.id] ?? { high: 0, warn: 0 };
    return {
      sessionId: s.id,
      status: s.status,
      startTime: s.start_time,
      isFlagged: s.is_flagged,
      applicantName: inv?.name ?? (inv?.email ? inv.email.split("@")[0] : "-"),
      applicantEmail: inv?.email ?? "-",
      organization: inv?.organization ?? "-",
      highCount: counts.high,
      warnCount: counts.warn,
      lastEvent: lastEventBySession[s.id] ?? null,
      unreadMessageCount: unreadBySession[s.id]?.count ?? 0,
      latestUnreadMessage: unreadBySession[s.id]
        ? {
            content: unreadBySession[s.id].content,
            createdAt: unreadBySession[s.id].createdAt,
          }
        : null,
    };
  });

  return NextResponse.json({
    sessions: enrichedSessions,
    events: (recentEvents ?? []).map((e) => {
      const s = (sessions ?? []).find((x) => x.id === e.session_id);
      const inv = s?.invitation_id ? invMap[s.invitation_id] : null;
      return {
        id: e.id,
        sessionId: e.session_id,
        eventType: e.event_type,
        severity: e.severity,
        detectedAt: e.detected_at,
        questionIndex: e.question_index,
        applicantName: inv?.name ?? (inv?.email ? inv.email.split("@")[0] : "-"),
        payload: e.payload,
      };
    }),
  });
}
