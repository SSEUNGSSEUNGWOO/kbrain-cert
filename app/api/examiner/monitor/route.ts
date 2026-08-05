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
      "id, status, start_time, submit_time, is_flagged, auto_submitted, invitation_id, agora_shard, monitor_acked_at"
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
    { data: latestMessages },
  ] =
    await Promise.all([
      invitationIds.length
        ? admin
            .from("exam_invitations")
            .select(
              "id, name, email, organization, allow_no_webcam, allow_no_screen_share, allow_dual_monitor"
            )
            .in("id", invitationIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string | null; email: string; organization: string | null; allow_no_webcam: boolean | null; allow_no_screen_share: boolean | null; allow_dual_monitor: boolean | null }> }),
      sessionIds.length
        ? admin
            .from("monitoring_events")
            .select(
              "id, session_id, event_type, severity, detected_at, question_index, payload"
            )
            .in("session_id", sessionIds)
            .neq("severity", "warn")
            .order("detected_at", { ascending: false })
            .limit(50)
        : Promise.resolve({ data: [] as Array<{ id: number; session_id: string; event_type: string; severity: string; detected_at: string; question_index: number | null; payload: unknown }> }),
      sessionIds.length
        ? admin
            .from("monitoring_events")
            .select("session_id, severity, detected_at")
            .in("session_id", sessionIds)
            .eq("severity", "high")
            .order("detected_at", { ascending: false })
            .limit(5000)
        : Promise.resolve({ data: [] as Array<{ session_id: string; severity: string; detected_at: string }> }),
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
      sessionIds.length
        ? admin
            .from("session_messages")
            .select("session_id, sender_role, content, created_at")
            .in("session_id", sessionIds)
            .order("created_at", { ascending: false })
            .limit(500)
        : Promise.resolve({ data: [] as Array<{ session_id: string; sender_role: string; content: string; created_at: string }> }),
    ]);

  const invMap: Record<
    string,
    {
      name: string | null;
      email: string;
      organization: string | null;
      allowNoWebcam: boolean;
      allowNoScreenShare: boolean;
      allowDualMonitor: boolean;
    }
  > = {};
  for (const inv of invitations ?? []) {
    invMap[inv.id] = {
      name: inv.name,
      email: inv.email,
      organization: inv.organization,
      allowNoWebcam: !!inv.allow_no_webcam,
      allowNoScreenShare: !!inv.allow_no_screen_share,
      allowDualMonitor: !!inv.allow_dual_monitor,
    };
  }

  // 감독관 확인(ack) 시각 이전의 high 이벤트는 주목 필요 카운트에서 제외
  const ackedAtMs: Record<string, number> = {};
  for (const s of sessions ?? []) {
    const acked = (s as { monitor_acked_at?: string | null }).monitor_acked_at;
    if (acked) ackedAtMs[s.id] = new Date(acked).getTime();
  }
  const highCount: Record<string, number> = {};
  for (const e of eventCounts ?? []) {
    const acked = ackedAtMs[e.session_id];
    if (
      acked != null &&
      new Date((e as { detected_at: string }).detected_at).getTime() <= acked
    ) {
      continue;
    }
    highCount[e.session_id] = (highCount[e.session_id] ?? 0) + 1;
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

  const latestBySession: Record<
    string,
    { senderRole: string; content: string; createdAt: string }
  > = {};
  for (const message of latestMessages ?? []) {
    if (!latestBySession[message.session_id]) {
      latestBySession[message.session_id] = {
        senderRole: message.sender_role,
        content: message.content,
        createdAt: message.created_at,
      };
    }
  }

  const enrichedSessions = (sessions ?? []).map((s) => {
    const inv = s.invitation_id ? invMap[s.invitation_id] : null;
    return {
      sessionId: s.id,
      status: s.status,
      startTime: s.start_time,
      isFlagged: s.is_flagged,
      agoraShard:
        (s as { agora_shard?: number | null }).agora_shard ?? null,
      applicantName: inv?.name ?? (inv?.email ? inv.email.split("@")[0] : "-"),
      applicantEmail: inv?.email ?? "-",
      organization: inv?.organization ?? "-",
      allowNoWebcam: inv?.allowNoWebcam ?? false,
      allowNoScreenShare: inv?.allowNoScreenShare ?? false,
      allowDualMonitor: inv?.allowDualMonitor ?? false,
      highCount: highCount[s.id] ?? 0,
      lastEvent: lastEventBySession[s.id] ?? null,
      unreadMessageCount: unreadBySession[s.id]?.count ?? 0,
      latestUnreadMessage: unreadBySession[s.id]
        ? {
            content: unreadBySession[s.id].content,
            createdAt: unreadBySession[s.id].createdAt,
          }
        : null,
      latestMessage: latestBySession[s.id] ?? null,
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
