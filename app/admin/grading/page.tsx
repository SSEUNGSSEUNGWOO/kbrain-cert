import {
  AdminShell,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatBox,
} from "@/components/admin-shell";
import { createAdminSupabase } from "@/lib/supabase/server";
import { GradingTable } from "./grading-table";

export const dynamic = "force-dynamic";

export default async function GradingPage() {
  const supabase = createAdminSupabase();

  const [{ data: sessions }, { data: exams }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("exam_sessions")
        .select(
          "id, exam_id, applicant_id, status, submit_time, score_total"
        )
        .order("submit_time", { ascending: false }),
      supabase.from("exams").select("id, title, pass_score"),
      supabase.from("profiles").select("id, name, email, organization"),
    ]);

  const examMap = Object.fromEntries((exams ?? []).map((e) => [e.id, e]));
  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // 각 세션의 max_score (exam_questions 합계) 계산
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const examIds = Array.from(
    new Set((sessions ?? []).map((s) => s.exam_id))
  );
  const { data: examQuestions } = examIds.length
    ? await supabase
        .from("exam_questions")
        .select("exam_id, question_id, questions(max_score)")
        .in("exam_id", examIds)
    : { data: [] };
  const maxScoreByExam: Record<string, number> = {};
  for (const eq of (examQuestions ?? []) as Array<{
    exam_id: string;
    questions: { max_score: number } | null;
  }>) {
    const ms = eq.questions?.max_score ?? 0;
    maxScoreByExam[eq.exam_id] = (maxScoreByExam[eq.exam_id] ?? 0) + Number(ms);
  }

  const rows = (sessions ?? []).map((s) => {
    const exam = examMap[s.exam_id];
    const profile = s.applicant_id ? profileMap[s.applicant_id] : null;
    const maxScore = maxScoreByExam[s.exam_id] ?? 0;
    const percentageScore =
      s.score_total !== null && maxScore > 0
        ? Math.round((Number(s.score_total) / maxScore) * 100)
        : null;
    return {
      id: s.id,
      applicantName: profile?.name ?? "-",
      applicantOrg: profile?.organization ?? "-",
      examTitle: exam?.title ?? "-",
      submittedAt: s.submit_time,
      rawScore: s.score_total !== null ? Number(s.score_total) : null,
      maxScore,
      percentageScore,
      passingScore: exam?.pass_score ?? 75,
      status: mapStatus(s.status),
    };
  });

  const stats = {
    pending: rows.filter((r) => r.status === "대기").length,
    inProgress: rows.filter((r) => r.status === "채점중").length,
    completed: rows.filter((r) => r.status === "완료").length,
    passRate: (() => {
      const completed = rows.filter((r) => r.status === "완료");
      if (completed.length === 0) return 0;
      const passed = completed.filter(
        (r) => (r.percentageScore ?? 0) >= r.passingScore
      ).length;
      return Math.round((passed / completed.length) * 100);
    })(),
  };

  return (
    <AdminShell active="grading">
      <PageHeader
        title="채점"
        description={`작업형 전용 · 슬롯별 부분점수 수동 채점 · 100점 환산 통일 · 답안 export · 전체 ${rows.length}건`}
        action={
          <>
            <SecondaryButton>답안 CSV/JSON Export</SecondaryButton>
            <PrimaryButton>대기 응답 채점 시작</PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatBox label="대기" value={stats.pending} unit="명" tone="warning" />
        <StatBox
          label="채점 중"
          value={stats.inProgress}
          unit="명"
          tone="info"
        />
        <StatBox label="완료" value={stats.completed} unit="명" tone="success" />
        <StatBox
          label="합격률"
          value={`${stats.passRate}%`}
          tone={stats.passRate >= 50 ? "success" : "danger"}
        />
      </div>

      <GradingTable rows={rows} />
    </AdminShell>
  );
}

function mapStatus(
  s: string
): "대기" | "채점중" | "완료" {
  if (s === "submitted") return "대기";
  if (s === "passed" || s === "failed") return "완료";
  return "채점중"; // in_progress / waiting은 채점자 관점에서 아직 대기 아님
}
