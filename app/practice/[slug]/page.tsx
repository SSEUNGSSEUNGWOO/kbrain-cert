import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import { AttachmentViewer, type Attachment } from "@/components/attachment-viewer";

export const dynamic = "force-dynamic";

/**
 * 테스트 링크 · 인증 없이 여러 번 접속 가능
 * - 실 시험과 동일한 첨부·문항 미리 보기
 * - 답안 저장 X · 감독 이벤트 X
 * - 응시자가 시험 전에 환경 익히기 용도
 */
export default async function PracticePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminSupabase();

  const { data: exam } = await supabase
    .from("exams")
    .select(
      "id, title, duration_minutes, pass_score, exam_date, practice_slug, grade_id"
    )
    .eq("practice_slug", slug)
    .maybeSingle();

  if (!exam) notFound();

  const [{ data: examSets }, { data: grades }] = await Promise.all([
    supabase
      .from("exam_sets")
      .select(
        "order_num, question_sets(id, title, scenario, attachments, order_num)"
      )
      .eq("exam_id", exam.id)
      .order("order_num"),
    supabase.from("exam_grades").select("id, name"),
  ]);

  const gradeName =
    exam.grade_id && (grades ?? []).find((g) => g.id === exam.grade_id)?.name;

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

  const totalFiles = sets.reduce((a, s) => a + s.attachments.length, 0);

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/85 border-b border-border">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
              k
            </div>
            <div className="font-bold text-lg tracking-tight">kbrain-cert</div>
          </Link>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-info bg-info-soft px-2.5 py-1 rounded-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-info" />
              PRACTICE · 테스트 링크
            </span>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-8 pb-6 border-b border-border">
          <div className="text-[11px] font-bold text-info tracking-[0.2em] uppercase mb-2">
            테스트 응시 · 답안 저장 없음 · 여러 번 접속 가능
          </div>
          <h1>{exam.title}</h1>
          <div className="mt-3 flex items-center gap-2 flex-wrap text-xs">
            {gradeName && (
              <span className="inline-flex items-center gap-1.5 font-bold text-primary bg-primary-soft px-2.5 py-1 rounded-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {gradeName} 등급
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 font-bold text-muted-foreground bg-surface-soft px-2.5 py-1 rounded-sm">
              {exam.duration_minutes}분
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold text-success bg-success-soft px-2.5 py-1 rounded-sm">
              합격 {exam.pass_score}/100
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold text-warning bg-warning-soft px-2.5 py-1 rounded-sm">
              세트 {sets.length}개 · 첨부 {totalFiles}개
            </span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            이 링크는 <b>시험 전 환경·문제 유형·첨부 자료를 미리 확인</b>하기 위한 페이지입니다.
            여러 번 접속하실 수 있고, 답안은 저장되지 않습니다. 실제 응시는 시험 당일 별도로 발송되는 응시 링크로 진행됩니다.
          </p>
        </div>

        <div className="space-y-8">
          {sets.map((s, i) => (
            <section
              key={s.id}
              className="rounded-md bg-white border border-border overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border bg-surface-soft flex items-baseline gap-3">
                <span className="font-tabular text-lg font-bold text-primary tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-0.5">
                    Set
                  </div>
                  <div className="text-lg font-bold text-heading">{s.title}</div>
                </div>
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">
                  첨부 {s.attachments.length}개
                </span>
              </div>
              {s.scenario && (
                <div className="px-6 py-4 border-b border-border bg-warning-soft/30">
                  <div className="text-[10px] font-bold tracking-widest text-warning uppercase mb-1">
                    시나리오
                  </div>
                  <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {s.scenario}
                  </div>
                </div>
              )}
              <div className="p-6">
                <AttachmentViewer
                  attachments={s.attachments}
                  practiceSlug={slug}
                  block
                />
              </div>
            </section>
          ))}
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-6 mt-8">
        <div className="rounded-md bg-surface-soft border border-border px-5 py-4 text-xs text-muted-foreground">
          <div className="font-bold text-foreground mb-1">
            테스트 링크 안내
          </div>
          <ul className="list-disc pl-5 leading-relaxed">
            <li>답안 저장 · 감독 · 채점 없음 · 자유 열람</li>
            <li>브라우저 내에서만 열람 · 파일 다운로드 불가</li>
            <li>실제 응시 링크는 시험 당일 이메일로 발송</li>
            <li>문의: {`support@kbrainc.com`}</li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
