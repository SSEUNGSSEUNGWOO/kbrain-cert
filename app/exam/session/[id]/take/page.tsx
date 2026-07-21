import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import { PracticeRunner } from "@/app/practice/[slug]/practice-runner";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

export const dynamic = "force-dynamic";

/**
 * 실 시험 페이지 · 명단의 이름·전화번호 뒷 4자리 검증 후 발급된 세션 쿠키로 접근
 * PracticeRunner 재사용 (sessionId 전달로 precheck 저장 자동 활성화)
 */
export default async function ExamSessionTakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const cookieSessionId = verifySessionCookieValue(cookieValue);
  if (!cookieSessionId || cookieSessionId !== id) {
    // 쿠키 없거나 세션 id 불일치 · 응시자 진입 재시작 유도
    redirect("/");
  }

  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select(
      "id, exam_id, status, invitation_id, submit_time, identity_image_url"
    )
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();

  if (session.submit_time) {
    // 이미 제출됨 · 재응시 방지 · 결과 페이지로 (M3 후속) or 홈으로
    redirect("/");
  }

  const { data: exam } = await admin
    .from("exams")
    .select(
      "id, title, duration_minutes, pass_score, grade_id, exam_date, allow_no_screen_share, allow_dual_monitor"
    )
    .eq("id", session.exam_id)
    .single();
  if (!exam) notFound();

  const { data: invitation } = session.invitation_id
    ? await admin
        .from("exam_invitations")
        .select("allow_no_webcam, allow_no_screen_share, allow_dual_monitor")
        .eq("id", session.invitation_id)
        .maybeSingle()
    : { data: null };

  const [{ data: grades }, { data: savedAnswers }] =
    await Promise.all([
      admin.from("exam_grades").select("id, name"),
      admin
        .from("answers")
        .select("question_id, slot_values")
        .eq("session_id", session.id),
    ]);

  const gradeName =
    exam.grade_id &&
    (grades ?? []).find((g) => g.id === exam.grade_id)?.name;

  return (
    <PracticeRunner
      slug="" // 실 시험은 slug 사용 X · 첨부 API는 세션 쿠키 인증
      exam={{
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.duration_minutes,
        passScore: exam.pass_score,
        grade: gradeName ?? "",
        examDate: exam.exam_date,
        allowNoWebcam: invitation?.allow_no_webcam ?? false,
        allowNoScreenShare:
          (exam.allow_no_screen_share ?? false) ||
          (invitation?.allow_no_screen_share ?? false),
        allowDualMonitor:
          (exam.allow_dual_monitor ?? false) ||
          (invitation?.allow_dual_monitor ?? false),
      }}
      sets={[]}
      questions={[]}
      sessionId={session.id}
      initialIdentityPath={session.identity_image_url}
      initialAnswers={Object.fromEntries(
        (savedAnswers ?? []).map((answer) => [
          answer.question_id,
          (answer.slot_values ?? {}) as Record<string, unknown>,
        ])
      )}
    />
  );
}
