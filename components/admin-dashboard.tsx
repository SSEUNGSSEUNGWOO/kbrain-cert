import Link from "next/link";
import { createAdminSupabase } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export const dynamic = "force-dynamic";

/* ─────────── 데이터 로드 ─────────── */

async function loadDashboard() {
  const supabase = createAdminSupabase();

  const [
    { data: settings },
    { data: categories },
    { data: grades },
    { data: exams },
    { data: sessions },
    { data: events },
    { count: totalQuestions },
  ] = await Promise.all([
    supabase.from("site_settings").select("key, value"),
    supabase.from("question_categories").select("id, name"),
    supabase.from("exam_grades").select("id, name"),
    supabase
      .from("exams")
      .select(
        "id, title, status, exam_date, duration_minutes, max_participants, pass_score, grade_id, created_at"
      )
      .order("created_at", { ascending: false }),
    supabase.from("exam_sessions").select("id, status"),
    supabase
      .from("monitoring_events")
      .select("id, session_id, event_type, detected_at, severity")
      .order("detected_at", { ascending: false })
      .limit(5),
    supabase.from("questions").select("*", { count: "exact", head: true }),
  ]);

  const settingsMap = Object.fromEntries(
    (settings ?? []).map((s) => [s.key, s.value])
  );
  const gradeMap = Object.fromEntries(
    (grades ?? []).map((g) => [g.id, g.name])
  );

  const examIds = (exams ?? []).map((e) => e.id);
  const [{ data: examSets }, { data: examQuestions }] = examIds.length
    ? await Promise.all([
        supabase.from("exam_sets").select("exam_id").in("exam_id", examIds),
        supabase
          .from("exam_questions")
          .select("exam_id")
          .in("exam_id", examIds),
      ])
    : [{ data: [] }, { data: [] }];
  const setCount: Record<string, number> = {};
  for (const s of examSets ?? [])
    setCount[s.exam_id] = (setCount[s.exam_id] ?? 0) + 1;
  const qCount: Record<string, number> = {};
  for (const q of examQuestions ?? [])
    qCount[q.exam_id] = (qCount[q.exam_id] ?? 0) + 1;

  const stats = {
    totalActive: (sessions ?? []).filter((s) => s.status === "in_progress")
      .length,
    totalSubmitted: (sessions ?? []).filter(
      (s) => s.status === "submitted" || s.status === "passed" || s.status === "failed"
    ).length,
    totalAlerts: (events ?? []).filter((e) => e.severity === "high").length,
    totalQuestions: totalQuestions ?? 0,
    totalExams: (exams ?? []).length,
  };

  return {
    siteTitle: settingsMap.site_title ?? "kbrain-cert",
    categoriesCount: (categories ?? []).length,
    gradesCount: (grades ?? []).length,
    stats,
    exams: (exams ?? []).slice(0, 5).map((e) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      grade: e.grade_id ? gradeMap[e.grade_id] ?? "-" : "-",
      examDate: e.exam_date,
      durationMinutes: e.duration_minutes,
      passScore: e.pass_score,
      setCount: setCount[e.id] ?? 0,
      questionCount: qCount[e.id] ?? 0,
    })),
    recentEvents: (events ?? []).map((e) => ({
      id: e.id,
      type: e.event_type,
      severity: e.severity,
      detectedAt: e.detected_at,
    })),
  };
}

/* ─────────── Page ─────────── */

export default async function Home() {
  const { user } = await requireRole("admin");
  const data = await loadDashboard();

  return (
    <div className="min-h-screen">
      <TopNav userEmail={user.email ?? "admin"} siteTitle={data.siteTitle} />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Hero />

        <div className="grid grid-cols-4 gap-3 mb-10">
          <StatCard
            label="응시 진행"
            value={data.stats.totalActive}
            unit="명"
            tone="blue"
          />
          <StatCard
            label="제출 완료"
            value={data.stats.totalSubmitted}
            unit="명"
            tone="emerald"
          />
          <StatCard
            label="주목 필요"
            value={data.stats.totalAlerts}
            unit="건"
            tone="red"
          />
          <StatCard
            label="등록 시험 · 문제"
            value={`${data.stats.totalExams}·${data.stats.totalQuestions}`}
            unit=""
            tone="orange"
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          <section className="col-span-2 space-y-3">
            <SectionHeader
              title="진행 · 예정 시험"
              tag="EXAMS"
              action="전체 보기"
              href="/admin/exams"
            />
            {data.exams.length === 0 ? (
              <EmptyRow message="등록된 시험이 없습니다. /admin/exams 에서 첫 시험을 등록하세요." />
            ) : (
              data.exams.map((e) => <ExamListCard key={e.id} exam={e} />)
            )}
          </section>

          <section>
            <SectionHeader
              title="최근 감독 이벤트"
              tag="LIVE"
              action=""
              href=""
            />
            <div className="rounded-md bg-white border border-border p-2">
              {data.recentEvents.length === 0 ? (
                <div className="p-4 text-xs text-muted-foreground text-center">
                  최근 이벤트 없음 · 시험 시작 시 실시간 표시
                </div>
              ) : (
                data.recentEvents.map((e) => <ActivityRow key={e.id} item={e} />)
              )}
            </div>
          </section>
        </div>

        <section className="mt-12">
          <SectionHeader
            title="프로토타입 미리보기"
            tag="PREVIEW"
            action=""
            href=""
          />
          <div className="grid grid-cols-3 gap-4">
            <PrototypeCard
              href="/applicant/waiting/session-me"
              label="응시자 대기실"
              role="APPLICANT · WAITING"
              step="01"
              description="환경 체크 · 신분증 · 서약 · 입실 카운트다운"
            />
            <PrototypeCard
              href="/applicant/exam/session-me"
              label="응시 페이지"
              role="APPLICANT · EXAM"
              step="02"
              description="타이머 · 슬롯형 답안 · 감독 배지"
            />
            <PrototypeCard
              href="/examiner/monitor"
              label="감독관 대시보드"
              role="EXAMINER · MONITOR"
              step="03"
              description="3단 알림 정렬 · 실시간 이벤트"
            />
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-12 pt-6 mt-8 text-sm text-muted-foreground">
        <div className="rounded-md bg-surface-soft px-6 py-5 flex items-center justify-between">
          <div>
            <div className="font-semibold text-foreground mb-1">
              {data.siteTitle}
            </div>
            <div className="text-xs">
              카테고리 {data.categoriesCount}개 · 등급 {data.gradesCount}개 · Supabase 실 데이터
            </div>
          </div>
          <div className="text-xs text-right">
            <div className="text-muted">최종 갱신</div>
            <div className="font-tabular text-foreground">2026.07.15</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────── Nav ─────────── */

function TopNav({
  userEmail,
  siteTitle,
}: {
  userEmail: string;
  siteTitle: string;
}) {
  const initial = userEmail.slice(0, 2).toUpperCase();
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-border">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-primary text-white flex items-center justify-center font-bold text-sm">
            k
          </div>
          <div className="font-bold text-lg tracking-tight">{siteTitle}</div>
          <div className="ml-3 text-[10px] font-bold tracking-[0.15em] text-primary bg-primary-soft px-2 py-0.5 rounded-sm">
            ADMIN
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <NavItem href="/" label="대시보드" active />
            <NavItem href="/admin/questions" label="문제은행" />
            <NavItem href="/admin/exams" label="시험" />
            <NavItem href="/admin/invitations" label="응시자" />
            <NavItem href="/examiner/monitor" label="감독" />
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right leading-tight">
              <div className="text-[10px] font-bold tracking-widest text-muted uppercase">
                Admin
              </div>
              <div className="text-xs font-bold truncate max-w-40">
                {userEmail}
              </div>
            </div>
            <div
              className="w-9 h-9 rounded-md bg-primary text-white flex items-center justify-center text-xs font-bold"
              title={userEmail}
            >
              {initial}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="text-[10px] font-bold tracking-widest text-muted-foreground hover:text-danger uppercase px-2 py-1 rounded-sm"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavItem({
  href,
  label,
  active = false,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md font-semibold transition ${
        active
          ? "text-primary bg-primary-soft"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-soft"
      }`}
    >
      {label}
    </Link>
  );
}

function Hero() {
  return (
    <div className="mb-8 pb-8 border-b border-border">
      <div className="text-[11px] font-bold text-primary mb-2 tracking-[0.2em] uppercase">
        Dashboard · 2026.07.15
      </div>
      <h1>실 데이터 기반 관리자 대시보드입니다.</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Supabase에서 실시간 조회 · 응시 세션이 시작되면 통계·이벤트가 자동 채워집니다.
      </p>
    </div>
  );
}

/* ─────────── Stat Card ─────────── */

function StatCard({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: number | string;
  unit: string;
  tone: "blue" | "emerald" | "red" | "orange";
}) {
  const style = {
    blue: "text-primary",
    emerald: "text-success",
    red: "text-danger",
    orange: "text-warning",
  }[tone];
  return (
    <div className="rounded-md bg-white border border-border p-5">
      <div className="text-[13px] font-semibold text-muted-foreground mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <div className={`font-tabular text-3xl font-bold ${style}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {unit && (
          <div className="text-sm font-semibold text-muted">{unit}</div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Section header ─────────── */

function SectionHeader({
  title,
  tag,
  action,
  href,
}: {
  title: string;
  tag: string;
  action: string;
  href: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="text-[10px] font-bold tracking-[0.15em] text-muted bg-surface-soft px-2 py-0.5 rounded-sm">
          {tag}
        </div>
      </div>
      {action && href && (
        <Link
          href={href}
          className="text-sm font-semibold text-primary hover:underline"
        >
          {action} →
        </Link>
      )}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/* ─────────── Exam Card (실 데이터) ─────────── */

type ExamRow = Awaited<ReturnType<typeof loadDashboard>>["exams"][number];

const statusStyle = {
  open: { text: "text-danger", bg: "bg-danger-soft", label: "OPEN", pulse: true },
  draft: { text: "text-info", bg: "bg-info-soft", label: "DRAFT", pulse: false },
  closed: {
    text: "text-muted-foreground",
    bg: "bg-surface-soft",
    label: "CLOSED",
    pulse: false,
  },
} as const;

function ExamListCard({ exam }: { exam: ExamRow }) {
  const status = statusStyle[exam.status as keyof typeof statusStyle] ?? statusStyle.draft;
  const examDate = exam.examDate
    ? new Date(exam.examDate).toISOString().slice(0, 10).replace(/-/g, ".")
    : "미정";
  return (
    <div className="rounded-md bg-white border border-border p-5 hover:border-primary transition cursor-pointer">
      <div className="flex items-start gap-4 mb-3">
        <div className="w-11 h-11 rounded-md bg-primary-soft text-primary flex items-center justify-center font-bold text-sm shrink-0">
          {exam.grade.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-sm ${status.bg} ${status.text}`}
            >
              {status.pulse && (
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              )}
              {status.label}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              {exam.grade}
            </span>
          </div>
          <div className="font-bold text-[--color-heading] text-base mb-1 truncate">
            {exam.title}
          </div>
          <div className="text-xs text-muted-foreground font-tabular">
            {examDate} · {exam.durationMinutes}분
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="세트" value={`${exam.setCount}`} />
        <MiniStat label="문항" value={`${exam.questionCount}`} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase mb-1">
        {label}
      </div>
      <div className="font-tabular text-sm font-bold text-foreground">
        {value}
      </div>
    </div>
  );
}

/* ─────────── Activity Row ─────────── */

const eventLabel: Record<string, string> = {
  face_missing: "얼굴 미검출",
  multiple_faces: "복수 인원 감지",
  fullscreen_exit: "전체화면 이탈",
  tab_switch: "탭 전환",
  recording_error: "녹화 오류",
};

const severityStyle: Record<string, { bg: string; text: string; icon: string }> = {
  high: { bg: "bg-danger-soft", text: "text-danger", icon: "⚠" },
  warn: { bg: "bg-warning-soft", text: "text-warning", icon: "!" },
  info: { bg: "bg-primary-soft", text: "text-primary", icon: "·" },
};

type EventRow = Awaited<ReturnType<typeof loadDashboard>>["recentEvents"][number];

function ActivityRow({ item }: { item: EventRow }) {
  const style = severityStyle[item.severity] ?? severityStyle.info;
  const label = eventLabel[item.type] ?? item.type;
  return (
    <div className="flex items-start gap-3 p-3 rounded-sm hover:bg-surface-hover transition cursor-pointer">
      <div
        className={`w-9 h-9 rounded-sm ${style.bg} ${style.text} flex items-center justify-center text-sm font-bold shrink-0`}
      >
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-foreground mb-0.5">{label}</div>
        <div className="text-xs text-muted-foreground truncate">
          {item.detectedAt}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Prototype Card ─────────── */

function PrototypeCard({
  href,
  label,
  role,
  description,
  step,
}: {
  href: string;
  label: string;
  role: string;
  description: string;
  step: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md bg-white p-5 border border-border hover:border-primary transition cursor-pointer block group"
    >
      <div className="flex items-baseline gap-3 mb-3">
        <div className="font-tabular text-xl font-bold text-primary tabular-nums">
          {step}
        </div>
        <div className="text-[10px] font-bold tracking-[0.15em] text-muted">
          {role}
        </div>
      </div>
      <div className="font-bold text-heading mb-2 text-lg">{label}</div>
      <div className="text-sm text-muted-foreground mb-4 leading-relaxed">
        {description}
      </div>
      <div className="text-sm font-semibold text-primary group-hover:underline">
        열어보기 →
      </div>
    </Link>
  );
}
