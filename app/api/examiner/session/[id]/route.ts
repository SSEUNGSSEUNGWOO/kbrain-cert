import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/**
 * 감독관 세션 상세 조회
 * 세션 전체 정보 + invitation + 이벤트 전체 + 답안 목록 + precheck
 */
export async function GET(
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
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "examiner"])
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const admin = createAdminSupabase();

  const { data: session } = await admin
    .from("exam_sessions")
    .select(
      "id, exam_id, status, start_time, submit_time, auto_submitted, is_flagged, invitation_id, precheck_env_result, precheck_pledge_accepted_at, precheck_waiting_entered_at, precheck_user_agent, updated_at, identity_image_url, identity_review_status, identity_review_note"
    )
    .eq("id", id)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const [{ data: exam }, { data: invitation }, { data: events }, { data: answers }, { data: examQs }] =
    await Promise.all([
      admin
        .from("exams")
        .select("id, title, duration_minutes, pass_score, exam_date")
        .eq("id", session.exam_id)
        .single(),
      session.invitation_id
        ? admin
            .from("exam_invitations")
            .select("id, name, email, organization, sent_at, used_at")
            .eq("id", session.invitation_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      admin
        .from("monitoring_events")
        .select("id, event_type, severity, detected_at, question_index, payload")
        .eq("session_id", id)
        .order("detected_at", { ascending: false })
        .limit(200),
      admin
        .from("answers")
        .select("id, question_id, slot_values, submitted_at, updated_at")
        .eq("session_id", id),
      admin
        .from("exam_questions")
        .select(
          "order_num, questions(id, code, content, submission_slots, max_score, set_id, set_order)"
        )
        .eq("exam_id", session.exam_id)
        .order("order_num"),
    ]);

  const questions = (examQs ?? []).map(
    (eq) =>
      (eq as unknown as {
        questions: {
          id: string;
          code: string;
          content: string;
          submission_slots: Array<{
            id: string;
            type: string;
            label: string;
            max_score: number;
          }>;
          max_score: number;
          set_id: string;
          set_order: number;
        };
      }).questions
  );

  const answerCounts = {
    answered: (answers ?? []).filter((a) =>
      Object.values(a.slot_values ?? {}).some(
        (v) => v !== "" && v != null
      )
    ).length,
    total: questions.length,
  };

  const severityCounts = {
    high: (events ?? []).filter((e) => e.severity === "high").length,
    warn: (events ?? []).filter((e) => e.severity === "warn").length,
    info: (events ?? []).filter((e) => e.severity === "info").length,
  };

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      startTime: session.start_time,
      submitTime: session.submit_time,
      autoSubmitted: session.auto_submitted,
      isFlagged: session.is_flagged,
      updatedAt: session.updated_at,
      envResult: session.precheck_env_result,
      pledgeAcceptedAt: session.precheck_pledge_accepted_at,
      waitingEnteredAt: session.precheck_waiting_entered_at,
      userAgent: session.precheck_user_agent,
      identityImageUrl: session.identity_image_url,
      identityReviewStatus: session.identity_review_status,
      identityReviewNote: session.identity_review_note,
    },
    exam: exam
      ? {
          id: exam.id,
          title: exam.title,
          durationMinutes: exam.duration_minutes,
          passScore: exam.pass_score,
          examDate: exam.exam_date,
        }
      : null,
    invitation: invitation
      ? {
          id: invitation.id,
          name: invitation.name,
          email: invitation.email,
          organization: invitation.organization,
          sentAt: invitation.sent_at,
          usedAt: invitation.used_at,
        }
      : null,
    events: (events ?? []).map((e) => ({
      id: e.id,
      eventType: e.event_type,
      severity: e.severity,
      detectedAt: e.detected_at,
      questionIndex: e.question_index,
      payload: e.payload,
    })),
    answers: (answers ?? []).map((a) => ({
      id: a.id,
      questionId: a.question_id,
      slotValues: a.slot_values,
      submittedAt: a.submitted_at,
      updatedAt: a.updated_at,
    })),
    questions: questions.map((q) => ({
      id: q.id,
      code: q.code,
      content: q.content,
      submissionSlots: q.submission_slots,
      maxScore: q.max_score,
      setOrder: q.set_order,
    })),
    counts: {
      answered: answerCounts.answered,
      totalQuestions: answerCounts.total,
      highEvents: severityCounts.high,
      warnEvents: severityCounts.warn,
      infoEvents: severityCounts.info,
    },
  });
}
