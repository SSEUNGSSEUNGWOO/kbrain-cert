import {
  AdminShell,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatBox,
} from "@/components/admin-shell";
import { createAdminSupabase } from "@/lib/supabase/server";
import { ExamsFilter } from "./exams-filter";

export const dynamic = "force-dynamic";

type ExamRow = {
  id: string;
  title: string;
  status: "open" | "draft" | "closed";
  grade: string;
  examDate: string | null;
  durationMinutes: number;
  maxParticipants: number | null;
  setCount: number;
  questionCount: number;
  passScore: number;
  practiceSlug: string | null;
  slug: string | null;
};

export default async function ExamsPage() {
  const supabase = createAdminSupabase();

  const { data: exams } = await supabase
    .from("exams")
    .select(
      "id, title, status, exam_date, duration_minutes, max_participants, pass_score, grade_id, practice_slug, slug"
    )
    .order("created_at", { ascending: false });

  const { data: grades } = await supabase.from("exam_grades").select("id, name");
  const gradeMap = Object.fromEntries((grades ?? []).map((g) => [g.id, g.name]));

  const examIds = (exams ?? []).map((e) => e.id);
  const [{ data: examSets }, { data: examQuestions }] = examIds.length
    ? await Promise.all([
        supabase.from("exam_sets").select("exam_id").in("exam_id", examIds),
        supabase
          .from("exam_questions")
          .select("exam_id")
          .in("exam_id", examIds),
      ])
    : [{ data: [] }, { data: [] }];

  const setCount: Record<string, number> = {};
  for (const s of examSets ?? [])
    setCount[s.exam_id] = (setCount[s.exam_id] ?? 0) + 1;
  const qCount: Record<string, number> = {};
  for (const q of examQuestions ?? [])
    qCount[q.exam_id] = (qCount[q.exam_id] ?? 0) + 1;

  const rows: ExamRow[] = (exams ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    status: e.status,
    grade: e.grade_id ? gradeMap[e.grade_id] ?? "-" : "-",
    examDate: e.exam_date,
    durationMinutes: e.duration_minutes,
    maxParticipants: e.max_participants,
    setCount: setCount[e.id] ?? 0,
    questionCount: qCount[e.id] ?? 0,
    passScore: e.pass_score,
    practiceSlug: (e as { practice_slug: string | null }).practice_slug ?? null,
    slug: e.slug,
  }));

  const stats = {
    total: rows.length,
    open: rows.filter((r) => r.status === "open").length,
    draft: rows.filter((r) => r.status === "draft").length,
    closed: rows.filter((r) => r.status === "closed").length,
  };

  return (
    <AdminShell active="exams">
      <PageHeader
        title="시험 관리"
        description="시험 CRUD · 세트 조합 · 응시자 초대 · 결과 관리 (Supabase 실 데이터)"
        action={
          <>
            <SecondaryButton>템플릿에서 복제</SecondaryButton>
            <PrimaryButton>+ 새 시험</PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatBox label="전체 시험" value={stats.total} unit="개" />
        <StatBox label="Open" value={stats.open} unit="개" tone="danger" />
        <StatBox label="Draft" value={stats.draft} unit="개" tone="info" />
        <StatBox label="Closed" value={stats.closed} unit="개" tone="success" />
      </div>

      <ExamsFilter rows={rows} />
    </AdminShell>
  );
}
