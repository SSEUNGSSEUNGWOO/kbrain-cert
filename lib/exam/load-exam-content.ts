import type { Attachment } from "@/components/attachment-viewer";
import { createAdminSupabase } from "@/lib/supabase/server";

export type ExamContentSet = {
  id: string;
  title: string;
  scenario: string | null;
  attachments: Attachment[];
};

export type ExamContentQuestion = {
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

export async function loadExamContent(examId: string): Promise<{
  sets: ExamContentSet[];
  questions: ExamContentQuestion[];
}> {
  const admin = createAdminSupabase();
  const [{ data: examSets }, { data: examQuestions }] = await Promise.all([
    admin
      .from("exam_sets")
      .select(
        "order_num, question_sets(id, title, scenario, attachments, order_num)"
      )
      .eq("exam_id", examId)
      .order("order_num"),
    admin
      .from("exam_questions")
      .select(
        "order_num, questions(id, code, content, submission_slots, max_score, set_id, set_order, tags, difficulty)"
      )
      .eq("exam_id", examId)
      .order("order_num"),
  ]);

  const sets = (examSets ?? []).map((examSet) => {
    const set = (examSet as unknown as {
      question_sets: ExamContentSet;
    }).question_sets;
    return {
      ...set,
      attachments: (set.attachments ?? []) as Attachment[],
    };
  });

  const questions = (examQuestions ?? [])
    .map(
      (examQuestion) =>
        (examQuestion as unknown as {
          questions: ExamContentQuestion;
        }).questions
    )
    .sort((left, right) => {
      const leftSet = sets.findIndex((set) => set.id === left.set_id);
      const rightSet = sets.findIndex((set) => set.id === right.set_id);
      if (leftSet !== rightSet) return leftSet - rightSet;
      return left.set_order - right.set_order;
    });

  return { sets, questions };
}
