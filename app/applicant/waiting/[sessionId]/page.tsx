"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockExam, mockWaitingChecks } from "@/lib/mock";
import { cn, formatTime } from "@/lib/utils";

type StepKey = "check" | "identity" | "pledge" | "waiting";

const steps: { key: StepKey; num: string; label: string; en: string }[] = [
  { key: "check", num: "01", label: "환경 체크", en: "ENV CHECK" },
  { key: "identity", num: "02", label: "신분증 촬영", en: "IDENTITY" },
  { key: "pledge", num: "03", label: "보안 서약", en: "PLEDGE" },
  { key: "waiting", num: "04", label: "입실 대기", en: "STANDBY" },
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
    <div className="flex flex-col min-h-screen">
      <header className="rule-b flex items-center px-8 h-16">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-gold text-base">◆</span>
          <span className="text-[10px] tracking-[0.3em] font-semibold text-primary">
            KBRAIN CERT
          </span>
        </Link>
        <div className="flex-1 flex items-baseline gap-4 pl-8 min-w-0">
          <span className="text-[10px] tracking-[0.35em] text-gold font-semibold">
            APPLICANT · WAITING
          </span>
          <span className="w-1 h-1 rounded-full bg-[--color-line-strong]" />
          <span className="text-sm text-muted-fg truncate">
            {mockExam.title}
          </span>
        </div>
        <span className="text-[10px] tracking-[0.3em] text-gold-strong font-semibold">
          {mockExam.grade.replace("(", "· ").replace(")", "")}
        </span>
      </header>

      <div className="flex-1 flex justify-center py-16 px-8">
        <div className="w-full max-w-3xl">
          <div className="mb-16 grid grid-cols-4 gap-6">
            {steps.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={s.key}>
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className={cn(
                        "gutter-numeral text-2xl",
                        done && "text-gold-strong",
                        active && "text-gold",
                        !done && !active && "text-[--color-subtle]"
                      )}
                    >
                      {s.num}
                    </span>
                    <div
                      className={cn(
                        "flex-1 h-px",
                        done ? "bg-[--color-line-gold]" : "bg-[--color-line]"
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "text-[10px] tracking-[0.35em] mb-1 font-semibold",
                      done ? "text-gold-strong" : active ? "text-gold" : "text-muted"
                    )}
                  >
                    {s.en}
                  </div>
                  <div
                    className={cn(
                      "text-sm font-serif font-bold",
                      active ? "text-primary" : done ? "text-muted-fg" : "text-muted"
                    )}
                  >
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div>
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

          <div className="mt-12 pt-6 rule-t-gold flex items-center gap-3 justify-center text-[10px] tracking-[0.3em]">
            <StatusChip label="ENV" done={checksPassed} />
            <StatusChip label="ID" done={identityUploaded} />
            <StatusChip label="PLEDGE" done={pledgeAgreed} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusChip({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={cn(
        "px-3 py-1 font-semibold",
        done ? "text-gold-strong" : "text-muted"
      )}
    >
      {done ? "◆" : "◇"} {label}
    </span>
  );
}

/* ─────────── Step 1: 환경 체크 ─────────── */

function CheckStep({ onContinue }: { onContinue: () => void }) {
  const allOk = mockWaitingChecks.every(
    (c) => c.status === "ok" || c.status === "warn"
  );
  return (
    <div>
      <div className="mb-10">
        <div className="text-[10px] tracking-[0.4em] text-gold mb-3 font-semibold">
          STEP 01 · ENVIRONMENT CHECK
        </div>
        <h2 className="font-serif mb-3">환경 체크</h2>
        <p className="text-sm text-muted-fg leading-relaxed max-w-xl">
          시험 중 안정적인 감독을 위해 다음 항목이 모두 정상 작동해야 합니다.
        </p>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-6">
        <div className="aspect-video bg-gradient-to-br from-slate-800 via-slate-900 to-black flex items-center justify-center text-white/25">
          <div className="text-center">
            <svg
              viewBox="0 0 24 24"
              className="w-12 h-12 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <rect x="3" y="7" width="12" height="10" rx="2" />
              <path d="M15 10l6-3v10l-6-3z" />
            </svg>
            <div className="text-[10px] tracking-[0.3em]">WEBCAM PREVIEW</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="surface-elevated border-l-2 border-[--color-line-gold] px-4 py-3">
            <div className="text-[9px] tracking-[0.3em] text-gold mb-1.5">
              MIC LEVEL
            </div>
            <div className="flex gap-0.5 h-4">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1",
                    i < 12
                      ? i < 8
                        ? "bg-[--color-success]"
                        : i < 15
                        ? "bg-[--color-warning]"
                        : "bg-[--color-danger]"
                      : "bg-[--color-line]"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="surface-elevated border-l-2 border-[--color-line-gold] px-4 py-3">
            <div className="text-[9px] tracking-[0.3em] text-gold mb-1.5">
              CPU BENCHMARK
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-tabular text-3xl font-bold text-gold-strong">
                92
              </span>
              <span className="text-xs text-muted-fg tracking-wider">
                / 100 · ABOVE THRESHOLD
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="divide-y divide-[--color-line] mb-10">
        {mockWaitingChecks.map((c) => (
          <CheckItem key={c.id} check={c} />
        ))}
      </div>

      <button
        onClick={onContinue}
        disabled={!allOk}
        className={cn(
          "w-full h-12 text-xs tracking-[0.35em] font-bold transition",
          allOk
            ? "bg-gold text-[--color-primary-foreground] hover:bg-gold-strong"
            : "bg-[--color-line] text-muted cursor-not-allowed"
        )}
        style={
          allOk
            ? {
                backgroundColor: "var(--color-gold)",
                color: "var(--color-primary-foreground)",
              }
            : undefined
        }
      >
        NEXT · 신분증 촬영 →
      </button>
    </div>
  );
}

function CheckItem({ check }: { check: (typeof mockWaitingChecks)[number] }) {
  const iconChar =
    check.status === "ok" ? "◆" : check.status === "pending" ? "◇" : "!";
  const iconColor =
    check.status === "ok"
      ? "text-gold-strong"
      : check.status === "warn"
      ? "text-[--color-warning]"
      : check.status === "error"
      ? "text-[--color-danger]"
      : "text-muted";
  return (
    <div className="flex items-center gap-5 py-4">
      <div className={cn("text-lg w-6 flex-shrink-0", iconColor)}>
        {iconChar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-primary">{check.label}</div>
        <div className="text-[11px] text-muted-fg mt-0.5">
          {check.description}
        </div>
      </div>
      <div className="text-xs text-muted-fg font-tabular tracking-wider text-right">
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
    <div>
      <div className="mb-10">
        <div className="text-[10px] tracking-[0.4em] text-gold mb-3 font-semibold">
          STEP 02 · IDENTITY VERIFICATION
        </div>
        <h2 className="font-serif mb-3">신분증 촬영·업로드</h2>
        <p className="text-sm text-muted-fg leading-relaxed max-w-xl">
          본인 확인용 신분증 이미지가 필요합니다. 관리자가 시험 후 사후 검토합니다.
        </p>
      </div>

      <div className="mb-8 border-l-2 border-[--color-line-gold] py-3 px-5">
        <div className="text-[10px] tracking-[0.35em] text-gold font-semibold mb-1.5">
          PRIVACY NOTICE
        </div>
        <div className="text-xs text-muted-fg leading-relaxed">
          업로드된 신분증 이미지는 응시자 본인 확인 목적으로만 사용되며, 시험 종료 후
          30일 이내 자동 파기됩니다. 자동 얼굴 인식(AWS Rekognition 등)은 사용하지 않습니다.
        </div>
      </div>

      <div
        onClick={onUpload}
        className={cn(
          "border-l-2 border-dashed py-16 text-center cursor-pointer transition group",
          uploaded
            ? "border-gold surface-elevated"
            : "border-[--color-line-strong] hover:border-gold hover:surface-hover"
        )}
      >
        {uploaded ? (
          <>
            <div className="text-4xl mb-3 text-gold-strong">◆</div>
            <div className="text-sm font-semibold text-primary tracking-wider">
              id_ohjieun_240715.jpg
            </div>
            <div className="text-[10px] text-muted-fg mt-2 tracking-widest">
              UPLOADED · 2.1 MB · CLICK TO REUPLOAD
            </div>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3 text-muted-fg group-hover:text-gold transition">
              ◇
            </div>
            <div className="text-sm font-semibold text-primary mb-1.5">
              신분증 이미지를 드래그하거나 클릭하여 업로드
            </div>
            <div className="text-[10px] text-muted-fg tracking-widest">
              주민등록증 · 운전면허증 · 여권 · 학생증 · JPG/PNG · MAX 10MB
            </div>
          </>
        )}
      </div>

      <button
        onClick={onContinue}
        disabled={!uploaded}
        className={cn(
          "mt-8 w-full h-12 text-xs tracking-[0.35em] font-bold transition",
          uploaded
            ? "bg-gold text-[--color-primary-foreground] hover:bg-gold-strong"
            : "bg-[--color-line] text-muted cursor-not-allowed"
        )}
        style={
          uploaded
            ? {
                backgroundColor: "var(--color-gold)",
                color: "var(--color-primary-foreground)",
              }
            : undefined
        }
      >
        NEXT · 보안 서약 →
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
    <div>
      <div className="mb-10">
        <div className="text-[10px] tracking-[0.4em] text-gold mb-3 font-semibold">
          STEP 03 · SECURITY PLEDGE
        </div>
        <h2 className="font-serif mb-3">보안 서약</h2>
        <p className="text-sm text-muted-fg leading-relaxed max-w-xl">
          시험 진행 및 감독 방침에 동의하셔야 응시가 가능합니다.
        </p>
      </div>

      <div className="border-l-2 border-[--color-line-gold] pl-6 py-2 max-h-72 overflow-y-auto text-sm leading-[1.75] text-primary space-y-5 font-serif mb-8">
        <PledgeItem
          n="1"
          title="감독 방식 안내"
          body="응시 중 웹캠·마이크·화면공유 스트림이 감독관에게 실시간 송출되며, 세션 종료 시까지 Cloudflare R2에 녹화 저장됩니다. 얼굴·음성·전체화면 이탈 등은 브라우저에서 자동 감지됩니다."
        />
        <PledgeItem
          n="2"
          title="부정행위 금지 사항"
          body="타인 대리 응시 · 대화 · 통신 · 메모 참고 금지. 웹캠·마이크·화면공유 임의 종료 금지. 전체화면 5회 이상 이탈 시 자동 제출됩니다."
        />
        <PledgeItem
          n="3"
          title="세트별 감독 유연화"
          body="일부 문제 세트(작업형·외부 도구 허용)는 관리자 정책에 따라 감독이 일시 비활성화됩니다. 해당 구간에는 별도 배너가 표시되며, 다른 세트로 이동 시 감독이 자동 재활성화됩니다."
        />
        <PledgeItem
          n="4"
          title="개인정보 처리"
          body="신분증 이미지 · 응시 녹화 · 감독 이벤트 로그는 시험 종료 후 30일 이내 자동 파기됩니다."
        />
      </div>

      <label className="flex items-start gap-4 py-5 rule-t-gold rule-b-gold cursor-pointer group">
        <div
          className={cn(
            "text-xl flex-shrink-0 pt-0.5 transition",
            agreed
              ? "text-gold-strong"
              : "text-[--color-line-strong] group-hover:text-gold"
          )}
        >
          {agreed ? "◆" : "◇"}
        </div>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgree(e.target.checked)}
          className="sr-only"
        />
        <div className="text-sm text-primary leading-relaxed">
          위 내용을 모두 읽고 이해했으며, 부정행위 금지 및 감독 방침에 동의합니다.
          위반 시 응시 자격 박탈 및 향후 응시 제한에 이의를 제기하지 않겠습니다.
        </div>
      </label>

      <button
        onClick={onContinue}
        disabled={!agreed}
        className={cn(
          "mt-8 w-full h-12 text-xs tracking-[0.35em] font-bold transition",
          agreed
            ? "bg-gold text-[--color-primary-foreground] hover:bg-gold-strong"
            : "bg-[--color-line] text-muted cursor-not-allowed"
        )}
        style={
          agreed
            ? {
                backgroundColor: "var(--color-gold)",
                color: "var(--color-primary-foreground)",
              }
            : undefined
        }
      >
        SIGN & CONTINUE · 입실 대기 →
      </button>
    </div>
  );
}

function PledgeItem({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1">
        <span className="gutter-numeral text-base w-4">{n}</span>
        <span className="text-sm font-bold tracking-tight text-gold-strong">
          {title}
        </span>
      </div>
      <div className="pl-7 text-muted-fg text-sm leading-relaxed">{body}</div>
    </div>
  );
}

/* ─────────── Step 4: 대기 ─────────── */

function WaitingStep({ countdown }: { countdown: number }) {
  const canEnter = countdown < 3 * 60;
  return (
    <div className="text-center py-8">
      <div className="text-[10px] tracking-[0.4em] text-gold mb-3 font-semibold">
        STEP 04 · STANDBY
      </div>
      <h2 className="font-serif mb-3">입실 대기</h2>
      <p className="text-sm text-muted-fg mb-14">시험 시작 시각까지 대기해주세요.</p>

      <div className="mb-14">
        <div className="text-[10px] tracking-[0.4em] text-gold mb-4 font-semibold">
          COUNTDOWN
        </div>
        <div className="font-tabular text-8xl font-bold text-gold-strong leading-none">
          {formatTime(countdown)}
        </div>
      </div>

      <div className="max-w-md mx-auto text-sm text-muted-fg leading-relaxed mb-12 font-serif">
        입실 허용 시간은 시험 시작 <span className="text-gold-strong font-semibold">3분 전</span>부터입니다.
        그 이전에는 대기 상태로 유지되며, 시간이 되면 자동으로 응시 페이지로 전환됩니다.
      </div>

      <Link
        href="/applicant/exam/session-me"
        className={cn(
          "inline-flex items-center justify-center h-12 px-12 text-xs tracking-[0.35em] font-bold transition",
          canEnter
            ? "bg-gold text-[--color-primary-foreground] hover:bg-gold-strong"
            : "bg-[--color-line] text-muted pointer-events-none cursor-not-allowed"
        )}
        style={
          canEnter
            ? {
                backgroundColor: "var(--color-gold)",
                color: "var(--color-primary-foreground)",
              }
            : undefined
        }
      >
        {canEnter ? "ENTER EXAM →" : "STANDBY"}
      </Link>
    </div>
  );
}
