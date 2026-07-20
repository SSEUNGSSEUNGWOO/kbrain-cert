import Link from "next/link";
import { AdminShell, PageHeader, SecondaryButton } from "@/components/admin-shell";
import { createAdminSupabase } from "@/lib/supabase/server";
import { AttachmentViewer, type Attachment } from "@/components/attachment-viewer";

export const dynamic = "force-dynamic";

export default async function ExamPreviewPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const supabase = createAdminSupabase();

  const [{ data: exam }, { data: examSets }] = await Promise.all([
    supabase
      .from("exams")
      .select("id, title, duration_minutes, pass_score, exam_date")
      .eq("id", examId)
      .single(),
    supabase
      .from("exam_sets")
      .select("order_num, set_id, question_sets(id, title, scenario, attachments, order_num)")
      .eq("exam_id", examId)
      .order("order_num"),
  ]);

  if (!exam) {
    return (
      <AdminShell active="exams">
        <PageHeader title="시험을 찾을 수 없습니다" />
        <Link href="/admin/exams" className="text-sm text-primary hover:underline">
          ← 시험 관리로
        </Link>
      </AdminShell>
    );
  }

  const sets = (examSets ?? []).map((es) => {
    const s = (es as unknown as { question_sets: {
      id: string; title: string; scenario: string | null; attachments: Attachment[]
    } }).question_sets;
    return {
      id: s.id,
      title: s.title,
      scenario: s.scenario,
      attachments: (s.attachments ?? []) as Attachment[],
    };
  });

  return (
    <AdminShell active="exams">
      <PageHeader
        title={exam.title}
        description={`${exam.duration_minutes}분 · 합격 ${exam.pass_score}/100 · 첨부 자료 응시자 관점 미리보기`}
        action={
          <Link href="/admin/exams">
            <SecondaryButton>← 목록</SecondaryButton>
          </Link>
        }
      />

      <div className="space-y-8">
        {sets.map((s) => (
          <section
            key={s.id}
            className="rounded-md bg-white border border-border overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-border bg-surface-soft">
              <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-1">
                Set
              </div>
              <div className="text-lg font-bold text-heading">{s.title}</div>
              {s.scenario && (
                <div className="text-xs text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">
                  {s.scenario}
                </div>
              )}
            </div>
            <div className="p-6">
              <AttachmentViewer attachments={s.attachments} />
            </div>
          </section>
        ))}
        {sets.length === 0 && (
          <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            연결된 세트가 없습니다.
          </div>
        )}
      </div>
    </AdminShell>
  );
}
