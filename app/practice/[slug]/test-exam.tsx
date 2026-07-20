import { createAdminSupabase } from "@/lib/supabase/server";
import type { Attachment } from "@/components/attachment-viewer";
import { PracticeRunner } from "./practice-runner";
import { notFound } from "next/navigation";

export async function TestExam({
  examId,
  slug,
  skipToExam = false,
}: {
  examId: string;
  slug: string;
  skipToExam?: boolean;
}) {
  const supabase = createAdminSupabase();
  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, duration_minutes, pass_score, grade_id")
    .eq("id", examId)
    .eq("is_test_mode", true)
    .single();
  if (!exam) notFound();

  const [{ data: examSets }, { data: examQs }, { data: grades }] =
    await Promise.all([
      supabase
        .from("exam_sets")
        .select("order_num, question_sets(id, title, scenario, attachments)")
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
    (grades ?? []).find((grade) => grade.id === exam.grade_id)?.name;
  const sets = (examSets ?? []).map((examSet) => {
    const set = (examSet as unknown as {
      question_sets: {
        id: string;
        title: string;
        scenario: string | null;
        attachments: Attachment[];
      };
    }).question_sets;
    return {
      id: set.id,
      title: set.title,
      scenario: set.scenario,
      attachments: (set.attachments ?? []) as Attachment[],
    };
  });
  const questions = (examQs ?? [])
    .map(
      (examQuestion) =>
        (
          examQuestion as unknown as {
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
          }
        ).questions
    )
    .sort((a, b) => {
      const setA = sets.findIndex((set) => set.id === a.set_id);
      const setB = sets.findIndex((set) => set.id === b.set_id);
      return setA === setB ? a.set_order - b.set_order : setA - setB;
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
        examDate: null,
      }}
      sets={sets}
      questions={questions}
      skipToExam={skipToExam}
    />
  );
}
