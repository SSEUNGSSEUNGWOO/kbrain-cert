import Link from "next/link";
import {
  mockAdminStats,
  mockExamCards,
  mockRecentActivity,
  type ActivityItem,
  type ExamCard,
} from "@/lib/mock";

const categoryStyle = {
  blue: "bg-primary-soft text-primary",
  purple: "bg-feature-soft text-feature",
  emerald: "bg-success-soft text-success",
  orange: "bg-warning-soft text-warning",
  pink: "bg-highlight-soft text-highlight",
  teal: "bg-info-soft text-info",
} as const;

const gradeStyle = {
  emerald: {
    dot: "bg-success",
    bg: "bg-success-soft",
    text: "text-success",
  },
  indigo: {
    dot: "bg-brand2",
    bg: "bg-brand2-soft",
    text: "text-brand2",
  },
  red: {
    dot: "bg-danger",
    bg: "bg-danger-soft",
    text: "text-danger",
  },
  yellow: {
    dot: "bg-caution",
    bg: "bg-caution-soft",
    text: "text-caution",
  },
} as const;

const activityStyle = {
  blue: { bg: "bg-primary-soft", text: "text-primary", icon: "▶" },
  emerald: { bg: "bg-success-soft", text: "text-success", icon: "✓" },
  orange: { bg: "bg-warning-soft", text: "text-warning", icon: "!" },
  red: { bg: "bg-danger-soft", text: "text-danger", icon: "⚠" },
  purple: { bg: "bg-feature-soft", text: "text-feature", icon: "+" },
} as const;

const prototypes = [
  {
    href: "/applicant/waiting/session-me",
    label: "응시자 대기실",
    role: "APPLICANT",
    description: "환경 체크 · 신분증 · 서약",
    icon: "👤",
    tone: "blue" as const,
  },
  {
    href: "/applicant/exam/session-me",
    label: "응시 페이지",
    role: "APPLICANT",
    description: "타이머 · 슬롯형 답안 · 감독",
    icon: "✍️",
    tone: "emerald" as const,
  },
  {
    href: "/examiner/monitor",
    label: "감독관 대시보드",
    role: "EXAMINER",
    description: "3단 알림 정렬 · 실시간",
    icon: "🔎",
    tone: "purple" as const,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Hero />

        {/* 통계 4개 */}
        <div className="grid grid-cols-4 gap-3 mb-10">
          <StatCard
            label="응시 진행"
            value={mockAdminStats.totalActive}
            unit="명"
            tone="blue"
            trend="+12"
          />
          <StatCard
            label="제출 완료"
            value={mockAdminStats.totalSubmitted}
            unit="명"
            tone="emerald"
            trend="+3"
          />
          <StatCard
            label="주목 필요"
            value={mockAdminStats.totalAlerts}
            unit="건"
            tone="red"
            trend="live"
          />
          <StatCard
            label="평균 진행"
            value={mockAdminStats.averageProgress}
            unit="%"
            tone="orange"
            trend="+2"
          />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 진행중 시험 리스트 (2/3) */}
          <section className="col-span-2 space-y-3">
            <SectionHeader
              title="진행 · 예정 시험"
              tag="EXAMS"
              action="전체 보기"
            />
            {mockExamCards.map((e) => (
              <ExamListCard key={e.id} exam={e} />
            ))}
          </section>

          {/* 최근 활동 (1/3) */}
          <section>
            <SectionHeader
              title="최근 활동"
              tag="LIVE"
              action="이벤트 로그"
            />
            <div className="rounded-2xl bg-white p-2 shadow-card">
              {mockRecentActivity.map((a) => (
                <ActivityRow key={a.id} item={a} />
              ))}
            </div>
          </section>
        </div>

        {/* 프로토타입 3개 링크 */}
        <section className="mt-12">
          <SectionHeader
            title="프로토타입 미리보기"
            tag="PREVIEW"
            action=""
          />
          <div className="grid grid-cols-3 gap-4">
            {prototypes.map((p) => (
              <PrototypeCard key={p.href} {...p} />
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-12 pt-6 mt-8 text-sm text-muted-foreground">
        <div className="rounded-2xl bg-surface-soft px-6 py-5 flex items-center justify-between">
          <div>
            <div className="font-semibold text-foreground mb-1">
              kbrain-cert
            </div>
            <div className="text-xs">
              승우님(daeasy) 소유 · 프로토타입 v0.3 · Toss-inspired ·
              작업형(슬롯형) 전용 결정 반영
            </div>
          </div>
          <div className="text-xs text-right">
            <div className="text-muted">최종 갱신</div>
            <div className="font-tabular text-foreground">
              2026.07.14
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─────────── 최상단 네비 ─────────── */

function TopNav() {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-border">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-sm">
            k
          </div>
          <div className="font-bold text-lg tracking-tight">kbrain-cert</div>
          <div className="ml-3 text-[10px] font-bold tracking-[0.15em] text-primary bg-primary-soft px-2 py-0.5 rounded-md">
            ADMIN
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <NavItem label="대시보드" active />
            <NavItem label="문제은행" />
            <NavItem label="시험" />
            <NavItem label="응시자" />
            <NavItem label="채점" />
            <NavItem label="설정" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-feature to-highlight text-white flex items-center justify-center text-xs font-bold">
              이명희
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavItem({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <div
      className={`px-3 py-1.5 rounded-lg font-semibold cursor-pointer transition ${
        active
          ? "text-primary bg-primary-soft"
          : "text-muted-foreground hover:text-foreground hover:bg-surface-soft"
      }`}
    >
      {label}
    </div>
  );
}

/* ─────────── 히어로 ─────────── */

function Hero() {
  return (
    <div className="mb-8">
      <div className="text-sm font-bold text-primary mb-2 tracking-wider">
        👋 안녕하세요, 이명희 관리자님
      </div>
      <h1>오늘 3개 시험이 진행 · 예정입니다</h1>
      <p className="mt-2 text-muted-foreground">
        가장 가까운 시험까지{" "}
        <span className="font-bold text-foreground">02:14</span> 남았어요.
      </p>
    </div>
  );
}

/* ─────────── 통계 카드 ─────────── */

function StatCard({
  label,
  value,
  unit,
  tone,
  trend,
}: {
  label: string;
  value: number;
  unit: string;
  tone: "blue" | "emerald" | "red" | "orange";
  trend: string;
}) {
  const style = {
    blue: "text-primary",
    emerald: "text-success",
    red: "text-danger",
    orange: "text-warning",
  }[tone];
  const bg = {
    blue: "bg-primary-soft",
    emerald: "bg-success-soft",
    red: "bg-danger-soft",
    orange: "bg-warning-soft",
  }[tone];
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[13px] font-semibold text-muted-foreground">
          {label}
        </div>
        <div className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${bg} ${style}`}>
          {trend}
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <div className={`font-tabular text-3xl font-bold ${style}`}>
          {value.toLocaleString()}
        </div>
        <div className="text-sm font-semibold text-muted">{unit}</div>
      </div>
    </div>
  );
}

/* ─────────── 섹션 헤더 ─────────── */

function SectionHeader({
  title,
  tag,
  action,
}: {
  title: string;
  tag: string;
  action: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="text-[10px] font-bold tracking-[0.15em] text-muted bg-surface-soft px-2 py-0.5 rounded-md">
          {tag}
        </div>
      </div>
      {action && (
        <button className="text-sm font-semibold text-primary hover:underline">
          {action} →
        </button>
      )}
    </div>
  );
}

/* ─────────── 시험 리스트 카드 ─────────── */

function ExamListCard({ exam }: { exam: ExamCard }) {
  const cat = categoryStyle[exam.categoryTone];
  const grade = gradeStyle[exam.gradeTone];
  const registrationPct = Math.round((exam.registered / exam.capacity) * 100);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card hover:shadow-card-hover transition cursor-pointer">
      <div className="flex items-start gap-4 mb-3">
        <div className={`w-11 h-11 rounded-xl ${cat} flex items-center justify-center font-bold text-sm shrink-0`}>
          {exam.category.slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md ${cat}`}
            >
              {exam.category.toUpperCase()}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md ${grade.bg} ${grade.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${grade.dot}`} />
              {exam.grade}
            </span>
            {exam.status === "live" && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md bg-danger-soft text-danger">
                <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <div className="font-bold text-heading text-base mb-1 truncate">
            {exam.title}
          </div>
          <div className="text-xs text-muted-foreground">
            {exam.date} · {exam.time}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
            응시 등록
          </div>
          <div className="flex items-baseline gap-1 mb-1.5">
            <span className="font-tabular text-lg font-bold text-foreground">
              {exam.registered}
            </span>
            <span className="text-sm text-muted">
              / {exam.capacity}명 · {registrationPct}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-subtle overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${registrationPct}%` }}
            />
          </div>
        </div>
        {exam.status === "live" && exam.progress !== undefined && (
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
              평균 진행률
            </div>
            <div className="flex items-baseline gap-1 mb-1.5">
              <span className="font-tabular text-lg font-bold text-success">
                {exam.progress}
              </span>
              <span className="text-sm text-muted">%</span>
            </div>
            <div className="h-1.5 rounded-full bg-subtle overflow-hidden">
              <div
                className="h-full bg-success rounded-full"
                style={{ width: `${exam.progress}%` }}
              />
            </div>
          </div>
        )}
        {exam.status === "upcoming" && (
          <div className="flex items-end">
            <button className="ml-auto rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm px-4 py-2">
              응시자 초대
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── 활동 로그 아이템 ─────────── */

function ActivityRow({ item }: { item: ActivityItem }) {
  const style = activityStyle[item.tone];
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-hover transition cursor-pointer">
      <div
        className={`w-9 h-9 rounded-full ${style.bg} ${style.text} flex items-center justify-center text-sm font-bold shrink-0`}
      >
        {style.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm mb-0.5">
          <span className="font-bold">{item.actor}</span>
          <span className="text-muted-foreground"> · {item.action}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {item.target}
        </div>
      </div>
      <div className="text-[11px] text-muted font-medium shrink-0 mt-0.5">
        {item.time}
      </div>
    </div>
  );
}

/* ─────────── 프로토타입 카드 ─────────── */

function PrototypeCard({
  href,
  label,
  role,
  description,
  icon,
  tone,
}: {
  href: string;
  label: string;
  role: string;
  description: string;
  icon: string;
  tone: "blue" | "emerald" | "purple";
}) {
  const style = {
    blue: "bg-primary-soft text-primary",
    emerald: "bg-success-soft text-success",
    purple: "bg-feature-soft text-feature",
  }[tone];
  return (
    <Link
      href={href}
      className="rounded-2xl bg-white p-5 shadow-card hover:shadow-card-hover transition cursor-pointer block group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-11 h-11 rounded-xl ${style} flex items-center justify-center text-2xl shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-[0.15em] text-muted mb-1">
            {role}
          </div>
          <div className="font-bold text-heading mb-1">{label}</div>
        </div>
      </div>
      <div className="text-sm text-muted-foreground mb-3">
        {description}
      </div>
      <div className="text-sm font-semibold text-primary group-hover:underline">
        열어보기 →
      </div>
    </Link>
  );
}
