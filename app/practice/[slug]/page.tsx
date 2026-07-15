import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import { PracticeRunner } from "./practice-runner";
import type { Attachment } from "@/components/attachment-viewer";

export const dynamic = "force-dynamic";

/**
 * 테스트 링크 · 인증 없이 여러 번 접속 가능
 * - 문항별 페이지 · 좌측 그리드 · 중앙 현재 문항 · 관련 첨부
 * - 답안 저장 X · 감독 X
 * - 응시자가 시험 전 미리 익히기
 */
export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ skip?: string }>;
}) {
  const { slug } = await params;
  const { skip } = await searchParams;
  const skipToExam = skip === "1" || skip === "true";
  const supabase = createAdminSupabase();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, duration_minutes, pass_score, grade_id, exam_date")
    .eq("practice_slug", slug)
    .maybeSingle();
  if (!exam) notFound();

  const [{ data: examSets }, { data: examQs }, { data: grades }] =
    await Promise.all([
      supabase
        .from("exam_sets")
        .select(
          "order_num, question_sets(id, title, scenario, attachments, order_num)"
        )
        .eq("exam_id", exam.id)
        .order("order_num"),
      supabase
        .from("exam_questions")
        .select(
          "order_num, questions(id, code, content, submission_slots, max_score, set_id, set_order, tags, difficulty)"
        )
        .eq("exam_id", exam.id)
        .order("order_num"),
      supabase.from("exam_grades").select("id, name"),
    ]);

  const gradeName =
    exam.grade_id &&
    (grades ?? []).find((g) => g.id === exam.grade_id)?.name;

  const sets = (examSets ?? []).map((es) => {
    const s = (es as {
      question_sets: {
        id: string;
        title: string;
        scenario: string | null;
        attachments: Attachment[];
      };
    }).question_sets;
    return {
      id: s.id,
      title: s.title,
      scenario: s.scenario,
      attachments: (s.attachments ?? []) as Attachment[],
    };
  });

  const questions = (examQs ?? [])
    .map((eq) => {
      const q = (eq as {
        questions: {
          id: string;
          code: string;
          content: string;
          submission_slots: Array<{
            id: string;
            type: "text" | "long_text" | "url" | "file" | "number";
            label: string;
            max_score: number;
            accept?: string;
          }>;
          max_score: number;
          set_id: string;
          set_order: number;
          tags: string[];
          difficulty: string | null;
        };
      }).questions;
      return q;
    })
    .sort((a, b) => {
      const setA = sets.findIndex((s) => s.id === a.set_id);
      const setB = sets.findIndex((s) => s.id === b.set_id);
      if (setA !== setB) return setA - setB;
      return a.set_order - b.set_order;
    });

  return (
    <PracticeRunner
      slug={slug}
      exam={{
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.duration_minutes,
        passScore: exam.pass_score,
        grade: gradeName ?? "",
        examDate: null, // Practice는 절대 시각 무시
      }}
      sets={sets}
      questions={questions}
      skipToExam={skipToExam}
    />
  );
}
