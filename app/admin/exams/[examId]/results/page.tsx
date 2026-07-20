import Link from "next/link";
import { AdminShell, PageHeader } from "@/components/admin-shell";
import { createAdminSupabase } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<
  string,
  { bg: string; label: string }
> = {
  waiting: { bg: "bg-info-soft text-info", label: "WAITING" },
  in_progress: { bg: "bg-primary text-white", label: "IN PROGRESS" },
  submitted: { bg: "bg-success-soft text-success", label: "SUBMITTED" },
  passed: { bg: "bg-success text-white", label: "PASSED" },
  failed: { bg: "bg-danger-soft text-danger", label: "FAILED" },
};

export default async function ExamResultsPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = await params;
  const supabase = createAdminSupabase();

  const { data: exam } = await supabase
    .from("exams")
    .select("id, title, duration_minutes, pass_score, exam_date, status")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) {
    return (
      <AdminShell active="exams">
        <PageHeader title="시험을 찾을 수 없습니다" />
      </AdminShell>
    );
  }

  const [{ data: sessions }, { data: examQuestions }] = await Promise.all([
    supabase
      .from("exam_sessions")
      .select(
        "id, status, start_time, submit_time, auto_submitted, is_flagged, time_extension_minutes, invitation_id, updated_at"
      )
      .eq("exam_id", examId)
      .order("start_time", { ascending: false, nullsFirst: true }),
    supabase
      .from("exam_questions")
      .select("question_id")
      .eq("exam_id", examId),
  ]);

  const totalQuestions = (examQuestions ?? []).length;
  const sessionIds = (sessions ?? []).map((s) => s.id);
  const invitationIds = Array.from(
    new Set((sessions ?? []).map((s) => s.invitation_id).filter(Boolean))
  ) as string[];

  const [{ data: invitations }, { data: answerCounts }, { data: eventCounts }] =
    await Promise.all([
      invitationIds.length
        ? supabase
            .from("exam_invitations")
            .select("id, name, email, organization")
            .in("id", invitationIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              name: string | null;
              email: string;
              organization: string | null;
            }>,
          }),
      sessionIds.length
        ? supabase
            .from("answers")
            .select("session_id, slot_values")
            .in("session_id", sessionIds)
        : Promise.resolve({
            data: [] as Array<{ session_id: string; slot_values: unknown }>,
          }),
      sessionIds.length
        ? supabase
            .from("monitoring_events")
            .select("session_id, severity")
            .in("session_id", sessionIds)
        : Promise.resolve({
            data: [] as Array<{ session_id: string; severity: string }>,
          }),
    ]);

  const invMap: Record<
    string,
    { name: string | null; email: string; organization: string | null }
  > = {};
  for (const inv of invitations ?? []) {
    invMap[inv.id] = {
      name: inv.name,
      email: inv.email,
      organization: inv.organization,
    };
  }

  const answeredPerSession: Record<string, number> = {};
  for (const a of answerCounts ?? []) {
    const values = a.slot_values as Record<string, unknown> | null;
    const hasContent =
      values &&
      Object.values(values).some((v) => v !== "" && v != null);
    if (hasContent) {
      answeredPerSession[a.session_id] =
        (answeredPerSession[a.session_id] ?? 0) + 1;
    }
  }

  const eventsPerSession: Record<string, { high: number; warn: number; info: number }> = {};
  for (const e of eventCounts ?? []) {
    if (!eventsPerSession[e.session_id])
      eventsPerSession[e.session_id] = { high: 0, warn: 0, info: 0 };
    if (e.severity === "high") eventsPerSession[e.session_id].high += 1;
    else if (e.severity === "warn") eventsPerSession[e.session_id].warn += 1;
    else eventsPerSession[e.session_id].info += 1;
  }

  const rows = (sessions ?? []).map((s) => {
    const inv = s.invitation_id ? invMap[s.invitation_id] : null;
    const answered = answeredPerSession[s.id] ?? 0;
    const evts = eventsPerSession[s.id] ?? { high: 0, warn: 0, info: 0 };
    const durationMs =
      s.start_time && s.submit_time
        ? new Date(s.submit_time).getTime() - new Date(s.start_time).getTime()
        : null;
    return {
      id: s.id,
      status: s.status,
      startTime: s.start_time,
      submitTime: s.submit_time,
      autoSubmitted: s.auto_submitted,
      isFlagged: s.is_flagged,
      timeExtensionMinutes: s.time_extension_minutes ?? 0,
      applicantName:
        inv?.name ?? (inv?.email ? inv.email.split("@")[0] : "익명"),
      applicantEmail: inv?.email ?? "-",
      organization: inv?.organization ?? "-",
      answered,
      answeredRate:
        totalQuestions > 0 ? Math.round((answered / totalQuestions) * 100) : 0,
      highEvents: evts.high,
      warnEvents: evts.warn,
      durationMinutes: durationMs ? Math.round(durationMs / 60000) : null,
    };
  });

  const stats = {
    total: rows.length,
    submitted: rows.filter((r) => r.submitTime).length,
    inProgress: rows.filter((r) => r.status === "in_progress" && !r.submitTime).length,
    waiting: rows.filter((r) => r.status === "waiting" && !r.submitTime).length,
    autoSubmitted: rows.filter((r) => r.autoSubmitted).length,
    flagged: rows.filter((r) => r.isFlagged).length,
    highEventsTotal: rows.reduce((sum, r) => sum + r.highEvents, 0),
    avgDurationMin: (() => {
      const submitted = rows.filter((r) => r.durationMinutes != null);
      if (submitted.length === 0) return 0;
      return Math.round(
        submitted.reduce((sum, r) => sum + (r.durationMinutes ?? 0), 0) /
          submitted.length
      );
    })(),
    fullyAnswered: rows.filter(
      (r) => totalQuestions > 0 && r.answered >= totalQuestions
    ).length,
  };

  const submissionRate =
    rows.length > 0 ? Math.round((stats.submitted / rows.length) * 100) : 0;

  return (
    <AdminShell active="exams">
      <PageHeader
        title={`${exam.title} · 결과·통계`}
        description={`시험 · ${exam.duration_minutes}분 · ${
          exam.exam_date
            ? `예약 ${new Date(exam.exam_date).toLocaleString("ko-KR")}`
            : "예약 시각 미정"
        }`}
        action={
          <>
            <a
              href={`/api/admin/exams/${examId}/export-answers`}
              className="h-9 px-4 rounded-md bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center transition"
            >
              ↓ 답안 zip 다운로드
            </a>
            <Link href="/admin/exams">
              <button className="h-9 px-4 rounded-md bg-white border border-border hover:border-primary text-xs font-bold transition">
                ← 목록
              </button>
            </Link>
          </>
        }
      />

      {/* 요약 통계 */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        <StatCard label="총 응시" value={stats.total} unit="명" tone="primary" />
        <StatCard label="제출 완료" value={stats.submitted} unit="명" tone="success" />
        <StatCard
          label="진행 중"
          value={stats.inProgress}
          unit="명"
          tone="primary"
        />
        <StatCard label="자동 제출" value={stats.autoSubmitted} unit="명" tone="warning" />
        <StatCard label="Flagged" value={stats.flagged} unit="명" tone="danger" pulse />
        <StatCard
          label="HIGH 이벤트"
          value={stats.highEventsTotal}
          unit="건"
          tone="danger"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <MetricCard
          label="응시 완료율"
          value={`${submissionRate}%`}
          hint={`${stats.submitted} / ${rows.length}`}
        />
        <MetricCard
          label="평균 소요 시간"
          value={
            stats.avgDurationMin > 0 ? `${stats.avgDurationMin}분` : "-"
          }
          hint={`${rows.filter((r) => r.durationMinutes != null).length}명 기준`}
        />
        <MetricCard
          label="전 문항 답변"
          value={`${stats.fullyAnswered}명`}
          hint={
            totalQuestions > 0
              ? `총 ${totalQuestions}문항 기준`
              : "문항 없음"
          }
        />
      </div>

      {/* 응시자 리스트 */}
      <div className="rounded-md bg-white border border-border overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
              Sessions
            </div>
            <div className="text-sm font-bold">응시자 목록 ({rows.length}명)</div>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            아직 응시자가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-soft">
                <tr className="text-left text-[10px] font-bold tracking-widest text-muted uppercase">
                  <th className="px-4 py-3">응시자</th>
                  <th className="px-3 py-3">조직</th>
                  <th className="px-3 py-3">상태</th>
                  <th className="px-3 py-3">시작</th>
                  <th className="px-3 py-3">소요</th>
                  <th className="px-3 py-3">답변</th>
                  <th className="px-3 py-3">이벤트</th>
                  <th className="px-4 py-3">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const st = STATUS_STYLE[r.status] ?? {
                    bg: "bg-surface-soft text-muted",
                    label: r.status,
                  };
                  return (
                    <tr
                      key={r.id}
                      className={cn(
                        "hover:bg-surface-hover transition",
                        r.isFlagged && "bg-danger-soft/20"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-sm">
                          {r.applicantName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.applicantEmail}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {r.organization}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span
                            className={cn(
                              "text-[10px] font-bold tracking-widest px-2 py-0.5 rounded-sm uppercase whitespace-nowrap",
                              st.bg
                            )}
                          >
                            {st.label}
                          </span>
                          {r.isFlagged && (
                            <span className="text-[10px] font-bold text-danger">
                              🚩
                            </span>
                          )}
                          {r.autoSubmitted && (
                            <span className="text-[9px] text-warning font-bold">
                              AUTO
                            </span>
                          )}
                          {r.timeExtensionMinutes > 0 && (
                            <span className="text-[9px] text-info font-bold">
                              +{r.timeExtensionMinutes}m
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[11px] text-muted-foreground font-tabular whitespace-nowrap">
                        {r.startTime
                          ? new Date(r.startTime).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-"}
                      </td>
                      <td className="px-3 py-3 text-[11px] text-muted-foreground font-tabular whitespace-nowrap">
                        {r.durationMinutes != null
                          ? `${r.durationMinutes}분`
                          : "-"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 bg-subtle rounded-full overflow-hidden w-16">
                            <div
                              className={cn(
                                "h-full",
                                r.answeredRate >= 100
                                  ? "bg-success"
                                  : r.answeredRate > 0
                                  ? "bg-primary"
                                  : "bg-subtle"
                              )}
                              style={{ width: `${r.answeredRate}%` }}
                            />
                          </div>
                          <div className="text-[10px] font-tabular text-muted-foreground whitespace-nowrap">
                            {r.answered}/{totalQuestions}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {r.highEvents > 0 && (
                            <span className="text-[10px] font-bold text-danger bg-danger-soft px-1.5 py-0.5 rounded-sm">
                              H {r.highEvents}
                            </span>
                          )}
                          {r.warnEvents > 0 && (
                            <span className="text-[10px] font-bold text-warning bg-warning-soft px-1.5 py-0.5 rounded-sm">
                              W {r.warnEvents}
                            </span>
                          )}
                          {r.highEvents === 0 && r.warnEvents === 0 && (
                            <span className="text-[10px] text-muted">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/examiner/session/${r.id}`}
                          className="text-[11px] font-bold text-primary hover:underline"
                        >
                          상세 →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}

function StatCard({
  label,
  value,
  unit,
  tone,
  pulse = false,
}: {
  label: string;
  value: number;
  unit: string;
  tone: "primary" | "success" | "danger" | "warning" | "info";
  pulse?: boolean;
}) {
  const text = {
    primary: "text-primary",
    success: "text-success",
    danger: "text-danger",
    warning: "text-warning",
    info: "text-info",
  }[tone];
  return (
    <div className="rounded-md bg-white border border-border p-4">
      <div className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1 uppercase">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <div className={cn("font-tabular text-2xl font-bold", text)}>
          {value}
        </div>
        <div className="text-sm font-bold text-muted">{unit}</div>
        {pulse && value > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse ml-1" />
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-md bg-white border border-border p-4">
      <div className="text-[10px] font-bold text-muted-foreground tracking-widest mb-1 uppercase">
        {label}
      </div>
      <div className="font-tabular text-xl font-bold text-primary mb-0.5">
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}
