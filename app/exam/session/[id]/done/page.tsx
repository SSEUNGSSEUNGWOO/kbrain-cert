import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

export const dynamic = "force-dynamic";

/**
 * 시험 제출 완료 페이지
 * 세션 쿠키로 인증 · 제출된 세션만 접근 가능
 */
export default async function ExamDonePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (!cookieSessionId || cookieSessionId !== id) {
    redirect("/");
  }

  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id, exam_id, submit_time, auto_submitted, start_time")
    .eq("id", id)
    .maybeSingle();
  if (!session) notFound();
  if (!session.submit_time) {
    // 아직 제출 안 함 → 시험 페이지로
    redirect(`/exam/session/${id}/take`);
  }

  const { data: exam } = await admin
    .from("exams")
    .select("title, duration_minutes")
    .eq("id", session.exam_id)
    .single();

  const { count: answeredCount } = await admin
    .from("answers")
    .select("id", { count: "exact", head: true })
    .eq("session_id", id);

  const durationMs =
    session.start_time && session.submit_time
      ? new Date(session.submit_time).getTime() -
        new Date(session.start_time).getTime()
      : 0;
  const durationMin = Math.floor(durationMs / 60000);
  const durationSec = Math.floor((durationMs % 60000) / 1000);

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
        <div className="rounded-md bg-gradient-to-br from-success to-success/70 text-white p-8 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold mb-4">
            ✓
          </div>
          <div className="text-lg font-bold mb-1">시험 응시 완료</div>
          <div className="text-xs opacity-80">
            {session.auto_submitted
              ? "시험 시간이 종료되어 자동 제출되었습니다"
              : "정상적으로 제출되었습니다"}
          </div>
        </div>

        <div className="rounded-md bg-white border border-border p-6 space-y-3">
          {exam && (
            <Row label="시험" value={exam.title} />
          )}
          <Row label="답변한 문항" value={`${answeredCount ?? 0}개`} />
          {durationMs > 0 && (
            <Row
              label="소요 시간"
              value={`${durationMin}분 ${durationSec}초`}
            />
          )}
          {session.submit_time && (
            <Row
              label="제출 시각"
              value={new Date(session.submit_time).toLocaleString("ko-KR")}
            />
          )}
        </div>

        <div className="rounded-md bg-info-soft border border-info p-5 text-sm">
          <div className="font-bold text-info mb-1">채점 안내</div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            제출된 답안은 감독관 검토 및 채점을 거쳐 결과가 이메일로 안내됩니다. 결과 발표까지 최대 7일이 소요될 수 있습니다.
          </div>
        </div>

        <div className="text-center pt-4">
          <Link
            href="/"
            className="inline-block h-11 px-6 leading-[44px] rounded-md bg-white border border-border text-sm font-bold hover:border-primary transition"
          >
            홈으로
          </Link>
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
