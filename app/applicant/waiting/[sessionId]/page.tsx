"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockExam, mockWaitingChecks } from "@/lib/mock";
import { cn, formatTime } from "@/lib/utils";

type StepKey = "check" | "identity" | "pledge" | "waiting";

const steps: {
  key: StepKey;
  num: number;
  label: string;
  description: string;
}[] = [
  {
    key: "check",
    num: 1,
    label: "환경 체크",
    description: "웹캠·마이크·화면공유·CPU·네트워크",
  },
  {
    key: "identity",
    num: 2,
    label: "신분증 촬영",
    description: "본인 확인 (관리자 사후 검토)",
  },
  {
    key: "pledge",
    num: 3,
    label: "보안 서약",
    description: "부정행위 금지 · 감독 동의",
  },
  {
    key: "waiting",
    num: 4,
    label: "입실 대기",
    description: "시험 시작 카운트다운",
  },
];

export default function WaitingRoomPage() {
  const [currentStep, setCurrentStep] = useState<StepKey>("check");
  const [checksPassed, setChecksPassed] = useState(false);
  const [identityUploaded, setIdentityUploaded] = useState(false);
  const [pledgeAgreed, setPledgeAgreed] = useState(false);
  const [entryCountdown, setEntryCountdown] = useState(8 * 60 + 42);

  useEffect(() => {
    if (currentStep !== "waiting") return;
    const t = setInterval(
      () => setEntryCountdown((c) => Math.max(0, c - 1)),
      1000
    );
    return () => clearInterval(t);
  }, [currentStep]);

  const stepIdx = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-6 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="h-8 w-8 rounded-md bg-slate-900 text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          >
            KB
          </Link>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-widest text-slate-400">
              CBT · 응시자 대기실
            </div>
            <div className="text-sm font-semibold text-slate-900 truncate">
              {mockExam.title}
            </div>
          </div>
          <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            {mockExam.grade}
          </span>
        </div>
      </header>

      <div className="flex-1 mx-auto max-w-4xl w-full px-6 py-8">
        <Stepper steps={steps} activeIdx={stepIdx} />

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
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
          {currentStep === "waiting" && (
            <WaitingStep countdown={entryCountdown} />
          )}
        </div>

        <div className="mt-4 flex items-center gap-2 justify-center text-xs">
          <StatusChip label="환경 확인" done={checksPassed} />
          <StatusChip label="신분증 제출" done={identityUploaded} />
          <StatusChip label="서약 동의" done={pledgeAgreed} />
        </div>
      </div>
    </div>
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
    <div className="grid grid-cols-4 gap-2">
      {steps.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx;
        return (
          <div key={s.key} className="relative">
            <div className="flex items-center gap-2 mb-2">
              <div
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold tabular-nums transition",
                  done && "bg-emerald-500 text-white",
                  active && "bg-blue-600 text-white ring-4 ring-blue-100",
                  !done && !active && "bg-slate-100 text-slate-500"
                )}
              >
                {done ? "✓" : s.num}
              </div>
              <div
                className={cn(
                  "h-0.5 flex-1 rounded-full",
                  done ? "bg-emerald-400" : "bg-slate-200"
                )}
              />
            </div>
            <div
              className={cn(
                "text-sm font-bold",
                active
                  ? "text-slate-900"
                  : done
                  ? "text-emerald-700"
                  : "text-slate-500"
              )}
            >
              {s.label}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
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
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold",
        done
          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-500"
      )}
    >
      {done ? "✓" : "○"} {label}
    </span>
  );
}

/* ─────────── Step 1: 환경 체크 ─────────── */

function CheckStep({ onContinue }: { onContinue: () => void }) {
  const allOk = mockWaitingChecks.every(
    (c) => c.status === "ok" || c.status === "warn"
  );
  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-blue-600 font-semibold mb-1.5">
          STEP 1 · 환경 체크
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">
          응시 환경을 확인합니다
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          시험 중 안정적인 감독을 위해 다음 항목이 모두 정상 작동해야 합니다.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="aspect-video rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 flex items-center justify-center text-white/50 border border-slate-200">
          <div className="text-center">
            <svg
              viewBox="0 0 24 24"
              className="w-12 h-12 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="7" width="12" height="10" rx="2" />
              <path d="M15 10l6-3v10l-6-3z" />
            </svg>
            <div className="text-[10px] uppercase tracking-widest">
              웹캠 프리뷰
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-blue-50/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2">
              마이크 볼륨
            </div>
            <div className="flex gap-0.5 h-4">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm",
                    i < 12
                      ? i < 8
                        ? "bg-emerald-500"
                        : i < 15
                        ? "bg-amber-400"
                        : "bg-rose-500"
                      : "bg-slate-200"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-emerald-50/40 p-3">
            <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">
              CPU 벤치마크
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-3xl font-bold text-emerald-700 tabular-nums">
                92
              </span>
              <span className="text-xs text-slate-500">
                / 100 · 권장 사양 이상
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 mb-6">
        {mockWaitingChecks.map((c) => (
          <CheckItem key={c.id} check={c} />
        ))}
      </div>

      <button
        onClick={onContinue}
        disabled={!allOk}
        className={cn(
          "w-full rounded-xl font-semibold py-3 text-sm shadow-sm transition",
          allOk
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "bg-slate-100 text-slate-400 cursor-not-allowed"
        )}
      >
        다음 · 신분증 촬영 →
      </button>
    </div>
  );
}

function CheckItem({ check }: { check: (typeof mockWaitingChecks)[number] }) {
  const map = {
    ok: {
      bg: "bg-emerald-100",
      text: "text-emerald-700",
      icon: "✓",
    },
    warn: {
      bg: "bg-amber-100",
      text: "text-amber-700",
      icon: "!",
    },
    error: {
      bg: "bg-rose-100",
      text: "text-rose-700",
      icon: "×",
    },
    pending: {
      bg: "bg-slate-100",
      text: "text-slate-500",
      icon: "…",
    },
  }[check.status];
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div
        className={cn(
          "flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center font-bold text-sm",
          map.bg,
          map.text
        )}
      >
        {map.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900">{check.label}</div>
        <div className="text-[11px] text-slate-500">{check.description}</div>
      </div>
      <div className="text-xs text-slate-500 font-mono tabular-nums text-right">
        {check.detail}
      </div>
    </div>
  );
}

/* ─────────── Step 2: 신분증 ─────────── */

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
    <div className="p-8">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-blue-600 font-semibold mb-1.5">
          STEP 2 · 신분증 촬영
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">
          본인 확인용 신분증을 업로드하세요
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          시험 후 관리자가 사후 검토합니다. 자동 얼굴 인식은 사용하지 않습니다.
        </p>
      </div>

      <div className="mb-6 rounded-xl border-2 border-amber-300 bg-amber-50/60 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg bg-amber-500 text-white text-lg">
            ⚑
          </div>
          <div className="text-sm text-amber-950 leading-relaxed">
            <b>개인정보 처리 안내</b> · 업로드된 신분증 이미지는 본인 확인
            목적으로만 사용되며, 시험 종료 후 30일 이내 자동 파기됩니다.
          </div>
        </div>
      </div>

      <div
        onClick={onUpload}
        className={cn(
          "rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition",
          uploaded
            ? "border-emerald-300 bg-emerald-50/60"
            : "border-slate-300 bg-slate-50/40 hover:border-blue-400 hover:bg-blue-50/40"
        )}
      >
        {uploaded ? (
          <>
            <div className="text-4xl mb-2">✓</div>
            <div className="text-sm font-bold text-emerald-800">
              id_ohjieun_240715.jpg 업로드 완료
            </div>
            <div className="text-xs text-slate-500 mt-1">
              2.1 MB · 클릭하여 재업로드
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl mb-2">📇</div>
            <div className="text-sm font-semibold text-slate-800 mb-1">
              신분증 이미지를 드래그하거나 클릭하여 업로드
            </div>
            <div className="text-xs text-slate-500">
              주민등록증 · 운전면허증 · 여권 · 학생증 · JPG/PNG · 최대 10MB
            </div>
          </>
        )}
      </div>

      <button
        onClick={onContinue}
        disabled={!uploaded}
        className={cn(
          "mt-6 w-full rounded-xl font-semibold py-3 text-sm shadow-sm transition",
          uploaded
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "bg-slate-100 text-slate-400 cursor-not-allowed"
        )}
      >
        다음 · 보안 서약 →
      </button>
    </div>
  );
}

/* ─────────── Step 3: 서약 ─────────── */

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
    <div className="p-8">
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-blue-600 font-semibold mb-1.5">
          STEP 3 · 보안 서약
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">
          부정행위 금지 서약
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          시험 진행 및 감독 방침에 동의하셔야 응시가 가능합니다.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-5 max-h-72 overflow-y-auto text-sm leading-relaxed text-slate-700 space-y-4 mb-6">
        <PledgeItem
          num="1"
          title="감독 방식 안내"
          body="응시 중 웹캠·마이크·화면공유 스트림이 감독관에게 실시간 송출되며, 세션 종료 시까지 Cloudflare R2에 녹화 저장됩니다. 얼굴·음성·전체화면 이탈 등은 브라우저에서 자동 감지됩니다."
        />
        <PledgeItem
          num="2"
          title="부정행위 금지"
          body="타인 대리 응시·대화·통신·메모 참고 금지. 웹캠·마이크·화면공유 임의 종료 금지. 전체화면 5회 이상 이탈 시 자동 제출됩니다."
        />
        <PledgeItem
          num="3"
          title="세트별 감독 유연화"
          body="일부 문제 세트(작업형·외부 도구 허용)는 감독이 일시 비활성화됩니다. 해당 구간에는 배너가 표시되며, 다른 세트로 이동 시 감독이 자동 재활성화됩니다."
        />
        <PledgeItem
          num="4"
          title="개인정보 처리"
          body="신분증 이미지·응시 녹화·감독 이벤트 로그는 시험 종료 후 30일 이내 자동 파기됩니다."
        />
      </div>

      <label className="flex items-start gap-3 rounded-xl border-2 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 p-4 cursor-pointer transition">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgree(e.target.checked)}
          className="mt-0.5 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <span className="text-sm text-slate-700 leading-relaxed">
          위 내용을 모두 읽고 이해했으며,{" "}
          <b className="text-slate-900">부정행위 금지 및 감독 방침에 동의</b>
          합니다. 위반 시 응시 자격 박탈 및 향후 응시 제한에 이의를 제기하지
          않겠습니다.
        </span>
      </label>

      <button
        onClick={onContinue}
        disabled={!agreed}
        className={cn(
          "mt-6 w-full rounded-xl font-semibold py-3 text-sm shadow-sm transition",
          agreed
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "bg-slate-100 text-slate-400 cursor-not-allowed"
        )}
      >
        서약 완료 · 입실 대기 →
      </button>
    </div>
  );
}

function PledgeItem({
  num,
  title,
  body,
}: {
  num: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="flex items-center justify-center h-5 w-5 rounded-md bg-slate-900 text-white text-[10px] font-bold tabular-nums">
          {num}
        </span>
        <span className="font-bold text-slate-900">{title}</span>
      </div>
      <div className="pl-7 text-slate-600">{body}</div>
    </div>
  );
}

/* ─────────── Step 4: 대기 ─────────── */

function WaitingStep({ countdown }: { countdown: number }) {
  const canEnter = countdown < 3 * 60;
  return (
    <div className="p-8 text-center">
      <div className="text-[10px] uppercase tracking-widest text-blue-600 font-semibold mb-1.5">
        STEP 4 · 입실 대기
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">
        시험 시작 시각까지 대기해주세요
      </h2>
      <p className="text-sm text-slate-600 mb-8">
        입실 허용 시간은 시험 시작 3분 전부터입니다.
      </p>

      <div className="inline-block rounded-2xl border-2 border-blue-300 bg-blue-50/60 px-14 py-6 mb-8">
        <div className="text-[10px] uppercase tracking-widest text-blue-700 font-semibold mb-2">
          시작까지 남은 시간
        </div>
        <div className="font-mono text-6xl font-bold text-blue-700 tabular-nums">
          {formatTime(countdown)}
        </div>
      </div>

      <div className="max-w-md mx-auto text-sm text-slate-600 leading-relaxed mb-8">
        시간이 되면 자동으로 응시 페이지로 전환됩니다. 그 이전에는 대기 상태로
        유지되며, 이 페이지를 벗어나지 마세요.
      </div>

      <Link
        href="/applicant/exam/session-me"
        className={cn(
          "inline-flex items-center justify-center rounded-xl font-semibold py-3 px-10 text-sm shadow-sm transition",
          canEnter
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : "bg-slate-100 text-slate-400 pointer-events-none cursor-not-allowed"
        )}
      >
        {canEnter ? "시험 입실 →" : "입실 대기 중"}
      </Link>
    </div>
  );
}
