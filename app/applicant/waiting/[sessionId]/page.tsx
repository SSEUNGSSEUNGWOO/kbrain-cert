"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockExam, mockWaitingChecks } from "@/lib/mock";
import { formatTime } from "@/lib/utils";

type StepKey = "check" | "identity" | "pledge" | "waiting";
const steps: { key: StepKey; num: number; label: string; description: string }[] = [
  { key: "check", num: 1, label: "환경 체크", description: "웹캠·마이크·화면공유·CPU·네트워크" },
  { key: "identity", num: 2, label: "신분증 촬영", description: "본인 확인용 이미지 업로드" },
  { key: "pledge", num: 3, label: "보안 서약", description: "부정행위 금지·감독 동의" },
  { key: "waiting", num: 4, label: "입실 대기", description: "시험 시작 카운트다운" },
];

export default function WaitingRoomPage() {
  const [currentStep, setCurrentStep] = useState<StepKey>("check");
  const [checksPassed, setChecksPassed] = useState(false);
  const [identityUploaded, setIdentityUploaded] = useState(false);
  const [pledgeAgreed, setPledgeAgreed] = useState(false);
  const [entryCountdown, setEntryCountdown] = useState(8 * 60 + 42);

  useEffect(() => {
    if (currentStep !== "waiting") return;
    const t = setInterval(() => setEntryCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [currentStep]);

  const stepIdx = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="min-h-screen">
      <TopBar />
      <main className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-6">
          <div className="text-sm font-bold text-[--color-primary] mb-2">
            👋 오지은님, 응시 준비를 시작할게요
          </div>
          <h1>{mockExam.title}</h1>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <Chip text="생성형AI 활용" tone="purple" />
            <Chip text="Black 등급" tone="red" dot />
            <Chip text="90분" tone="blue" />
            <Chip text="총점 300점 · 합격 75/100" tone="emerald" />
          </div>
        </div>

        <Stepper steps={steps} activeIdx={stepIdx} />

        <div className="mt-6 rounded-3xl bg-white p-8 shadow-[var(--shadow-card)]">
          {currentStep === "check" && (
            <CheckStep
              onContinue={() => {
                setChecksPassed(true);
                setCurrentStep("identity");
              }}
            />
          )}
          {currentStep === "identity" && (
            <IdentityStep
              uploaded={identityUploaded}
              onUpload={() => setIdentityUploaded(true)}
              onContinue={() => setCurrentStep("pledge")}
            />
          )}
          {currentStep === "pledge" && (
            <PledgeStep
              agreed={pledgeAgreed}
              onAgree={setPledgeAgreed}
              onContinue={() => setCurrentStep("waiting")}
            />
          )}
          {currentStep === "waiting" && <WaitingStep countdown={entryCountdown} />}
        </div>

        <div className="mt-4 flex items-center gap-2 justify-center">
          <StatusChip label="환경" done={checksPassed} />
          <StatusChip label="신분증" done={identityUploaded} />
          <StatusChip label="서약" done={pledgeAgreed} />
        </div>
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur-md bg-white/80 border-b border-[--color-border]">
      <div className="mx-auto max-w-3xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[--color-primary] text-white flex items-center justify-center font-bold text-sm">
            k
          </div>
          <div className="font-bold text-lg tracking-tight">kbrain-cert</div>
        </Link>
        <div className="text-[10px] font-bold tracking-[0.15em] text-[--color-primary] bg-[--color-primary-soft] px-2.5 py-1 rounded-md">
          APPLICANT
        </div>
      </div>
    </nav>
  );
}

function Chip({
  text,
  tone,
  dot = false,
}: {
  text: string;
  tone: "blue" | "purple" | "emerald" | "orange" | "red";
  dot?: boolean;
}) {
  const map = {
    blue: "bg-[--color-primary-soft] text-[--color-primary]",
    purple: "bg-[--color-purple-soft] text-[--color-purple]",
    emerald: "bg-[--color-emerald-soft] text-[--color-emerald]",
    orange: "bg-[--color-orange-soft] text-[--color-orange]",
    red: "bg-[--color-red-soft] text-[--color-red]",
  }[tone];
  const dotColor = {
    blue: "bg-[--color-primary]",
    purple: "bg-[--color-purple]",
    emerald: "bg-[--color-emerald]",
    orange: "bg-[--color-orange]",
    red: "bg-[--color-red]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-md ${map}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />}
      {text}
    </span>
  );
}

function Stepper({
  steps,
  activeIdx,
}: {
  steps: { key: StepKey; num: number; label: string; description: string }[];
  activeIdx: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.key}>
            <div className="flex items-center gap-2 mb-2">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold tabular-nums transition ${
                  done
                    ? "bg-[--color-emerald] text-white"
                    : active
                    ? "bg-[--color-primary] text-white ring-4 ring-[--color-primary-soft]"
                    : "bg-[--color-subtle] text-[--color-muted]"
                }`}
              >
                {done ? "✓" : s.num}
              </div>
              <div
                className={`flex-1 h-1 rounded-full ${
                  done ? "bg-[--color-emerald]" : "bg-[--color-subtle]"
                }`}
              />
            </div>
            <div
              className={`text-sm font-bold ${
                active
                  ? "text-[--color-foreground]"
                  : done
                  ? "text-[--color-emerald]"
                  : "text-[--color-muted]"
              }`}
            >
              {s.label}
            </div>
            <div className="text-[11px] text-[--color-muted-foreground] mt-0.5">
              {s.description}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusChip({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
        done
          ? "bg-[--color-emerald-soft] text-[--color-emerald]"
          : "bg-[--color-surface-soft] text-[--color-muted]"
      }`}
    >
      {done ? "✓" : "○"} {label}
    </span>
  );
}

/* ────── Step 1 ────── */

function CheckStep({ onContinue }: { onContinue: () => void }) {
  const allOk = mockWaitingChecks.every((c) => c.status === "ok" || c.status === "warn");
  return (
    <div>
      <StepHeader step="01" label="환경 체크" description="시험 중 안정적인 감독을 위해 다음 항목이 모두 정상 작동해야 합니다." />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="aspect-video rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-black flex flex-col items-center justify-center text-white/60">
          <div className="text-4xl mb-1">📷</div>
          <div className="text-[10px] font-bold tracking-[0.2em]">WEBCAM PREVIEW</div>
        </div>
        <div className="space-y-3">
          <div className="rounded-2xl bg-[--color-primary-soft] p-4">
            <div className="text-[10px] font-bold tracking-[0.15em] text-[--color-primary] mb-2">
              MIC LEVEL
            </div>
            <div className="flex gap-0.5 h-5">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${
                    i < 12
                      ? i < 8
                        ? "bg-[--color-emerald]"
                        : i < 15
                        ? "bg-[--color-orange]"
                        : "bg-[--color-red]"
                      : "bg-[--color-subtle]"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-[--color-emerald-soft] p-4">
            <div className="text-[10px] font-bold tracking-[0.15em] text-[--color-emerald] mb-1">
              CPU BENCHMARK
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-tabular text-3xl font-bold text-[--color-emerald]">
                92
              </span>
              <span className="text-xs font-bold text-[--color-muted]">/ 100 · 권장 이상</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-6">
        {mockWaitingChecks.map((c) => (
          <CheckItem key={c.id} check={c} />
        ))}
      </div>

      <CTAButton onClick={onContinue} disabled={!allOk}>
        다음으로 · 신분증 촬영
      </CTAButton>
    </div>
  );
}

function CheckItem({ check }: { check: (typeof mockWaitingChecks)[number] }) {
  const map = {
    ok: {
      bg: "bg-[--color-emerald-soft]",
      text: "text-[--color-emerald]",
      icon: "✓",
    },
    warn: {
      bg: "bg-[--color-orange-soft]",
      text: "text-[--color-orange]",
      icon: "!",
    },
    error: {
      bg: "bg-[--color-red-soft]",
      text: "text-[--color-red]",
      icon: "×",
    },
    pending: {
      bg: "bg-[--color-surface-soft]",
      text: "text-[--color-muted]",
      icon: "…",
    },
  }[check.status];
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-[--color-surface-soft] px-4 py-3">
      <div
        className={`w-10 h-10 rounded-xl ${map.bg} ${map.text} flex items-center justify-center font-bold`}
      >
        {map.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[--color-foreground]">{check.label}</div>
        <div className="text-[11px] text-[--color-muted-foreground]">
          {check.description}
        </div>
      </div>
      <div className="text-xs font-semibold text-[--color-muted-foreground] tabular-nums text-right">
        {check.detail}
      </div>
    </div>
  );
}

/* ────── Step 2 ────── */

function IdentityStep({
  uploaded,
  onUpload,
  onContinue,
}: {
  uploaded: boolean;
  onUpload: () => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <StepHeader
        step="02"
        label="신분증 촬영"
        description="본인 확인용 이미지를 업로드해주세요. 시험 후 관리자가 사후 검토합니다."
      />

      <div className="mb-6 rounded-2xl bg-[--color-orange-soft] p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[--color-orange] text-white flex items-center justify-center text-xl">
          📢
        </div>
        <div className="text-sm text-[--color-orange]">
          <span className="font-bold">개인정보 처리 안내</span> · 업로드된 신분증
          이미지는 본인 확인 목적으로만 사용되며, 시험 종료 후 30일 이내 자동
          파기됩니다. 자동 얼굴 인식은 사용하지 않습니다.
        </div>
      </div>

      <div
        onClick={onUpload}
        className={`rounded-3xl border-2 border-dashed p-12 text-center cursor-pointer transition ${
          uploaded
            ? "border-[--color-emerald] bg-[--color-emerald-soft]"
            : "border-[--color-border-strong] bg-[--color-surface-soft] hover:border-[--color-primary] hover:bg-[--color-primary-soft]"
        }`}
      >
        {uploaded ? (
          <>
            <div className="text-6xl mb-3">✅</div>
            <div className="font-bold text-[--color-emerald] mb-1">
              업로드 완료 · id_ohjieun_240715.jpg
            </div>
            <div className="text-xs text-[--color-muted-foreground]">
              2.1 MB · 클릭하여 재업로드
            </div>
          </>
        ) : (
          <>
            <div className="text-6xl mb-3">📇</div>
            <div className="font-bold text-[--color-foreground] mb-1">
              신분증 이미지를 드래그하거나 클릭하여 업로드
            </div>
            <div className="text-xs text-[--color-muted-foreground]">
              주민등록증 · 운전면허증 · 여권 · 학생증 · JPG/PNG · 최대 10MB
            </div>
          </>
        )}
      </div>

      <div className="mt-6">
        <CTAButton onClick={onContinue} disabled={!uploaded}>
          다음으로 · 보안 서약
        </CTAButton>
      </div>
    </div>
  );
}

/* ────── Step 3 ────── */

function PledgeStep({
  agreed,
  onAgree,
  onContinue,
}: {
  agreed: boolean;
  onAgree: (v: boolean) => void;
  onContinue: () => void;
}) {
  return (
    <div>
      <StepHeader
        step="03"
        label="보안 서약"
        description="시험 진행 및 감독 방침에 동의하셔야 응시가 가능합니다."
      />

      <div className="space-y-3 mb-6">
        <PledgeCard
          num="1"
          icon="🎥"
          tone="blue"
          title="감독 방식"
          body="응시 중 웹캠·마이크·화면공유 스트림이 감독관에게 실시간 송출되며, 세션 종료 시까지 Cloudflare R2에 녹화 저장됩니다. 얼굴·음성·전체화면 이탈 등은 브라우저에서 자동 감지됩니다."
        />
        <PledgeCard
          num="2"
          icon="🚫"
          tone="red"
          title="부정행위 금지"
          body="타인 대리 응시·대화·통신·메모 참고 금지. 웹캠·마이크·화면공유 임의 종료 금지. 전체화면 5회 이상 이탈 시 자동 제출됩니다."
        />
        <PledgeCard
          num="3"
          icon="⚙️"
          tone="orange"
          title="세트별 감독 유연화"
          body="일부 문제 세트(작업형·외부 도구 허용)는 감독이 일시 비활성화됩니다. 해당 구간에는 배너가 표시되며, 다른 세트로 이동 시 감독이 자동 재활성화됩니다."
        />
        <PledgeCard
          num="4"
          icon="🔒"
          tone="purple"
          title="개인정보 처리"
          body="신분증 이미지·응시 녹화·감독 이벤트 로그는 시험 종료 후 30일 이내 자동 파기됩니다."
        />
      </div>

      <label
        className={`flex items-start gap-4 rounded-2xl p-5 cursor-pointer transition border-2 ${
          agreed
            ? "border-[--color-primary] bg-[--color-primary-soft]"
            : "border-[--color-border] bg-white hover:border-[--color-primary]"
        }`}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgree(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 ${
            agreed
              ? "bg-[--color-primary] text-white"
              : "bg-[--color-subtle] text-[--color-muted]"
          }`}
        >
          {agreed ? "✓" : ""}
        </div>
        <div className="text-sm leading-relaxed">
          위 내용을 모두 읽고 이해했으며,{" "}
          <span className="font-bold">부정행위 금지 및 감독 방침에 동의</span>합니다.
          위반 시 응시 자격 박탈 및 향후 응시 제한에 이의를 제기하지 않겠습니다.
        </div>
      </label>

      <div className="mt-6">
        <CTAButton onClick={onContinue} disabled={!agreed}>
          서약 완료 · 입실 대기
        </CTAButton>
      </div>
    </div>
  );
}

function PledgeCard({
  num,
  icon,
  tone,
  title,
  body,
}: {
  num: string;
  icon: string;
  tone: "blue" | "red" | "orange" | "purple";
  title: string;
  body: string;
}) {
  const map = {
    blue: "bg-[--color-primary-soft] text-[--color-primary]",
    red: "bg-[--color-red-soft] text-[--color-red]",
    orange: "bg-[--color-orange-soft] text-[--color-orange]",
    purple: "bg-[--color-purple-soft] text-[--color-purple]",
  }[tone];
  return (
    <div className="rounded-2xl bg-[--color-surface-soft] p-4 flex gap-4">
      <div className={`w-11 h-11 rounded-xl ${map} flex items-center justify-center text-xl shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-bold tracking-widest text-[--color-muted]">
            {num}
          </span>
          <span className="font-bold text-[--color-foreground]">{title}</span>
        </div>
        <div className="text-[13px] text-[--color-muted-foreground] leading-relaxed">
          {body}
        </div>
      </div>
    </div>
  );
}

/* ────── Step 4 ────── */

function WaitingStep({ countdown }: { countdown: number }) {
  const canEnter = countdown < 3 * 60;
  return (
    <div className="text-center py-4">
      <div className="text-6xl mb-2">⏳</div>
      <StepHeader
        step="04"
        label="입실 대기"
        description="시험 시작 시각까지 대기해주세요. 시간이 되면 자동으로 응시 페이지로 전환됩니다."
      />

      <div className="my-8 inline-block rounded-3xl bg-[--color-primary-soft] px-16 py-8">
        <div className="text-[10px] font-bold tracking-[0.25em] text-[--color-primary] mb-3">
          COUNTDOWN
        </div>
        <div className="font-tabular text-6xl font-bold text-[--color-primary] leading-none">
          {formatTime(countdown)}
        </div>
      </div>

      <div className="max-w-md mx-auto text-sm text-[--color-muted-foreground] leading-relaxed mb-8">
        입실 허용 시간은 시험 시작 <span className="font-bold text-[--color-primary]">3분 전</span>부터입니다. 그 이전에는 대기 상태로 유지됩니다.
      </div>

      <Link
        href="/applicant/exam/session-me"
        className={`inline-flex items-center justify-center h-14 px-10 rounded-2xl font-bold text-base transition ${
          canEnter
            ? "bg-[--color-primary] hover:bg-[--color-primary-hover] text-white shadow-[var(--shadow-card)]"
            : "bg-[--color-subtle] text-[--color-muted] pointer-events-none cursor-not-allowed"
        }`}
      >
        {canEnter ? "시험 입실하기 →" : "입실 대기 중"}
      </Link>
    </div>
  );
}

/* ────── 공통 ────── */

function StepHeader({
  step,
  label,
  description,
}: {
  step: string;
  label: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <div className="text-xs font-bold tracking-widest text-[--color-primary] mb-2">
        STEP {step}
      </div>
      <h2 className="mb-2">{label}</h2>
      <p className="text-sm text-[--color-muted-foreground]">{description}</p>
    </div>
  );
}

function CTAButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full h-14 rounded-2xl font-bold text-base transition ${
        disabled
          ? "bg-[--color-subtle] text-[--color-muted] cursor-not-allowed"
          : "bg-[--color-primary] hover:bg-[--color-primary-hover] text-white shadow-[var(--shadow-card)]"
      }`}
    >
      {children}
    </button>
  );
}
