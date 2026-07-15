import Link from "next/link";
import { createAdminSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { MonitorLive } from "./monitor-live";

export const dynamic = "force-dynamic";

/**
 * 감독관 실시간 모니터 (실 데이터 · 5초 폴링)
 * ?examId=<uuid>로 특정 시험 선택 · 없으면 open 상태 시험 목록 표시
 */
export default async function ExaminerMonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>;
}) {
  await requireRole(["admin", "examiner"]);
  const { examId } = await searchParams;

  const supabase = createAdminSupabase();
  const { data: openExams } = await supabase
    .from("exams")
    .select("id, title, exam_date, duration_minutes, status")
    .in("status", ["open", "draft"])
    .order("exam_date", { ascending: false, nullsFirst: false });

  if (!examId) {
    return (
      <div className="min-h-screen">
        <TopBar title="모니터할 시험 선택" />
        <main className="mx-auto max-w-3xl px-6 py-10 space-y-3">
          <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
            Examiner · 실시간 모니터
          </div>
          <h2 className="text-xl font-bold mb-5">시험을 선택하세요</h2>
          {(openExams ?? []).length === 0 && (
            <div className="rounded-md border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              현재 open · draft 상태 시험이 없습니다.
            </div>
          )}
          {(openExams ?? []).map((e) => (
            <Link
              key={e.id}
              href={`/examiner/monitor?examId=${e.id}`}
              className="block rounded-md bg-white border border-border p-5 hover:border-primary transition"
            >
              <div className="flex items-center gap-3 mb-1">
                <span
                  className={`text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm uppercase ${
                    e.status === "open"
                      ? "bg-danger-soft text-danger"
                      : "bg-info-soft text-info"
                  }`}
                >
                  {e.status}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  {e.duration_minutes}분
                </span>
              </div>
              <div className="font-bold text-base">{e.title}</div>
              <div className="text-xs text-muted-foreground font-tabular mt-1">
                {e.exam_date
                  ? new Date(e.exam_date).toLocaleString("ko-KR")
                  : "예약 시각 미정"}
              </div>
            </Link>
          ))}
        </main>
      </div>
    );
  }

  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, duration_minutes, exam_date")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) {
    return (
      <div className="min-h-screen">
        <TopBar title="시험을 찾을 수 없습니다" />
      </div>
    );
  }

  return (
    <MonitorLive
      exam={{
        id: exam.id,
        title: exam.title,
        durationMinutes: exam.duration_minutes,
        examDate: exam.exam_date,
      }}
    />
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/90 border-b border-border">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
            k
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-[0.2em] text-muted uppercase">
              Kbrain Cert · Examiner
            </div>
            <div className="font-bold text-sm truncate max-w-md">{title}</div>
          </div>
        </Link>
      </div>
    </nav>
  );
}
