import {
  AdminShell,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  StatBox,
} from "@/components/admin-shell";
import { createAdminSupabase } from "@/lib/supabase/server";
import { QuestionsTable } from "./questions-table";

export const dynamic = "force-dynamic";

export default async function QuestionsPage() {
  const supabase = createAdminSupabase();

  const [{ data: questions }, { data: categories }, { data: grades }] =
    await Promise.all([
      supabase
        .from("questions")
        .select(
          "id, code, content, difficulty, tags, submission_slots, max_score, category_id, grade_id, updated_at"
        )
        .order("updated_at", { ascending: false }),
      supabase.from("question_categories").select("id, name, color"),
      supabase.from("exam_grades").select("id, name, color"),
    ]);

  // Count usages via exam_questions (per question)
  const questionIds = (questions ?? []).map((q) => q.id);
  const { data: usages } =
    questionIds.length > 0
      ? await supabase
          .from("exam_questions")
          .select("question_id")
          .in("question_id", questionIds)
      : { data: [] };
  const usageMap: Record<string, number> = {};
  for (const u of usages ?? []) {
    usageMap[u.question_id] = (usageMap[u.question_id] ?? 0) + 1;
  }

  const catMap = Object.fromEntries(
    (categories ?? []).map((c) => [c.id, c.name])
  );
  const gradeMap = Object.fromEntries((grades ?? []).map((g) => [g.id, g.name]));

  const rows = (questions ?? []).map((q) => ({
    id: q.id,
    code: q.code,
    content: q.content,
    difficulty: q.difficulty,
    tags: q.tags,
    slots: Array.isArray(q.submission_slots) ? q.submission_slots.length : 0,
    maxScore: q.max_score,
    category: q.category_id ? catMap[q.category_id] ?? "-" : "-",
    grade: q.grade_id ? gradeMap[q.grade_id] ?? "-" : "-",
    usedInExams: usageMap[q.id] ?? 0,
    updatedAt: q.updated_at.slice(0, 10).replace(/-/g, "."),
  }));

  const stats = {
    total: rows.length,
    inUse: rows.filter((r) => r.usedInExams > 0).length,
    unused: rows.filter((r) => r.usedInExams === 0).length,
    categories: (categories ?? []).length,
  };

  return (
    <AdminShell active="questions">
      <PageHeader
        title="문제은행"
        description={`전체 ${stats.total}개 · 작업형(슬롯형) 문항 · Supabase 실 데이터`}
        action={
          <>
            <SecondaryButton>JSON 대량 업로드</SecondaryButton>
            <PrimaryButton>+ 새 문제 등록</PrimaryButton>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatBox label="전체 문제" value={stats.total} unit="개" />
        <StatBox label="사용 중" value={stats.inUse} unit="개" tone="success" />
        <StatBox label="미사용" value={stats.unused} unit="개" tone="warning" />
        <StatBox
          label="카테고리"
          value={stats.categories}
          unit="개"
          tone="info"
        />
      </div>

      <QuestionsTable rows={rows} categories={categories ?? []} grades={grades ?? []} />
    </AdminShell>
  );
}
