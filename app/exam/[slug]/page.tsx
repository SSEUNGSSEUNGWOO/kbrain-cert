import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";
import { EntryFlow } from "./entry-flow";
import { TestExam } from "@/app/practice/[slug]/test-exam";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * 응시자 진입 페이지 · 인증 없이 접근 (시험 공용 링크)
 * URL: /exam/{slug} · slug 미설정 시 /exam/{examId}(UUID) fallback
 * 진입: 이름 + 전화 뒷4자리 → 명단 매칭 → 세션 생성 + HMAC 쿠키 발급
 */
export default async function ExamEntryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const admin = createAdminSupabase();

  const examQuery = admin
    .from("exams")
    .select("id, title, duration_minutes, exam_date, slug, is_test_mode");
  const { data: exam } = await (UUID_RE.test(slug)
    ? examQuery.eq("id", slug)
    : examQuery.eq("slug", slug)
  ).maybeSingle();
  if (!exam) return notFound();
  if (exam.is_test_mode) {
    return <TestExam examId={exam.id} slug={slug} />;
  }

  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (cookieSessionId) {
    const { data: cookieSession } = await admin
      .from("exam_sessions")
      .select("id, exam_id, submit_time")
      .eq("id", cookieSessionId)
      .maybeSingle();
    if (cookieSession && cookieSession.exam_id === exam.id) {
      if (cookieSession.submit_time) {
        redirect(`/exam/session/${cookieSession.id}/done`);
      }
      redirect(`/exam/session/${cookieSession.id}/take`);
    }
  }

  return (
    <div className="min-h-screen bg-surface-soft flex flex-col">
      <nav className="border-b border-border bg-white">
        <div className="mx-auto max-w-3xl px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
              k
            </div>
            <div className="font-bold text-lg tracking-tight">kbrain-cert</div>
          </Link>
        </div>
      </nav>

      <main className="flex-1 mx-auto max-w-lg w-full px-6 py-10 space-y-5">
        <div className="rounded-md bg-white border border-border p-6">
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
            응시자 진입
          </div>
          <h1 className="text-xl font-bold mb-1">{exam.title}</h1>
          <div className="text-xs text-muted-foreground">
            시험 시간 {exam.duration_minutes}분
            {exam.exam_date &&
              ` · 일시 ${new Date(exam.exam_date).toLocaleString("ko-KR")}`}
          </div>
        </div>

        <EntryFlow examId={exam.id} />

        <div className="text-[11px] text-muted-foreground text-center leading-relaxed">
          문의: <span className="font-tabular">no-reply@kbrainc.com</span>
        </div>
      </main>
    </div>
  );
}
