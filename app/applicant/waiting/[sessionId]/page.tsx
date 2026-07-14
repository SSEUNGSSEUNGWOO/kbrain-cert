"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockExam, mockWaitingChecks } from "@/lib/mock";
import { cn, formatTime } from "@/lib/utils";

type StepKey = "check" | "identity" | "pledge" | "waiting";

const steps: { key: StepKey; label: string; description: string }[] = [
  { key: "check", label: "환경 체크", description: "웹캠·마이크·화면공유·CPU·네트워크" },
  { key: "identity", label: "신분증 촬영", description: "본인 확인 (관리자 사후 검토)" },
  { key: "pledge", label: "보안 서약", description: "부정행위 금지 및 감독 동의" },
  { key: "waiting", label: "입실 대기", description: "시험 시작 시각 카운트다운" },
];

export default function WaitingRoomPage() {
  const [currentStep, setCurrentStep] = useState<StepKey>("check");
  const [checksPassed, setChecksPassed] = useState(false);
  const [identityUploaded, setIdentityUploaded] = useState(false);
  const [pledgeAgreed, setPledgeAgreed] = useState(false);
  const [entryCountdown, setEntryCountdown] = useState(8 * 60 + 42); // 8:42

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
      <header className="border-b border-strong bg-white flex items-center px-6 h-14">
        <Link
          href="/"
          className="text-xs font-semibold tracking-widest text-muted-fg hover:text-primary"
        >
          kbrain-cert
        </Link>
        <span className="text-muted mx-3">|</span>
        <span className="text-sm font-medium text-primary flex-1 truncate">
          응시자 대기실 · {mockExam.title}
        </span>
        <span className="inline-flex items-center h-6 px-2 rounded-sm bg-primary text-primary-foreground text-[10px] font-semibold tracking-wider">
          {mockExam.grade}
        </span>
      </header>

      <div className="flex-1 flex justify-center py-12 px-6 surface-muted">
        <div className="w-full max-w-3xl">
          {/* 스텝퍼 */}
          <div className="mb-10 grid grid-cols-4 gap-2">
            {steps.map((s, i) => {
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={s.key} className="relative">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-tabular font-bold border transition",
                        done && "bg-[--color-success] border-[--color-success] text-white",
                        active && "bg-primary border-primary text-primary-foreground",
                        !done && !active && "bg-white border-[--color-border] text-muted-fg"
                      )}
                    >
                      {done ? "✓" : i + 1}
                    </div>
                    <div
                      className={cn(
                        "h-px flex-1 transition",
                        done ? "bg-[--color-success]" : "bg-[--color-border]"
                      )}
                    />
                  </div>
                  <div
                    className={cn(
                      "text-xs font-semibold transition",
                      active ? "text-primary" : done ? "text-[--color-success]" : "text-muted"
                    )}
                  >
                    {s.label}
                  </div>
                  <div className="text-[10px] text-muted-fg mt-0.5">
                    {s.description}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 현재 스텝 카드 */}
          <div className="bg-white border border-[--color-border] rounded-md p-8 shadow-sm">
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

          {/* 하단 진행 상태 */}
          <div className="mt-6 flex items-center gap-2 text-xs text-muted-fg justify-center">
            <span
              className={cn(
                "px-2 py-0.5 rounded-sm border",
                checksPassed
                  ? "border-[--color-success] text-[--color-success]"
                  : "border-[--color-border]"
              )}
            >
              환경 {checksPassed ? "확인됨" : "미확인"}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-sm border",
                identityUploaded
                  ? "border-[--color-success] text-[--color-success]"
                  : "border-[--color-border]"
              )}
            >
              신분증 {identityUploaded ? "제출됨" : "미제출"}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded-sm border",
                pledgeAgreed
                  ? "border-[--color-success] text-[--color-success]"
                  : "border-[--color-border]"
              )}
            >
              서약 {pledgeAgreed ? "동의됨" : "미동의"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Step 1: 환경 체크 ─────────── */

function CheckStep({ onContinue }: { onContinue: () => void }) {
  const allOk = mockWaitingChecks.every((c) => c.status === "ok" || c.status === "warn");
  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] font-semibold tracking-widest text-muted-fg uppercase mb-1.5">
          Step 1
        </div>
        <h2 className="mb-1">환경 체크</h2>
        <p className="text-sm text-muted-fg">
          시험 중 안정적인 감독을 위해 다음 항목이 모두 정상 작동해야 합니다.
        </p>
      </div>

      {/* 웹캠 프리뷰 목업 */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="aspect-video bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950 rounded-md flex items-center justify-center text-white/40">
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
            <div className="text-[10px] tracking-widest">웹캠 프리뷰</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="border border-[--color-border] rounded-sm p-3">
            <div className="text-[10px] text-muted-fg tracking-widest mb-1">
              마이크 볼륨
            </div>
            <div className="flex gap-1 h-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex-1 rounded-sm",
                    i < 12
                      ? i < 8
                        ? "bg-[--color-success]"
                        : i < 15
                        ? "bg-[--color-warning]"
                        : "bg-[--color-danger]"
                      : "bg-[--color-subtle]"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="border border-[--color-border] rounded-sm p-3">
            <div className="text-[10px] text-muted-fg tracking-widest mb-1">
              CPU 벤치마크
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-tabular text-2xl font-bold text-primary">92</span>
              <span className="text-xs text-muted-fg">/ 100 · 권장 이상</span>
            </div>
          </div>
        </div>
      </div>

      {/* 체크리스트 */}
      <div className="space-y-2 mb-6">
        {mockWaitingChecks.map((c) => (
          <CheckItem key={c.id} check={c} />
        ))}
      </div>

      <button
        onClick={onContinue}
        disabled={!allOk}
        className={cn(
          "w-full h-11 rounded-sm text-sm font-semibold transition",
          allOk
            ? "bg-primary text-primary-foreground hover:bg-[--color-primary-hover]"
            : "bg-[--color-subtle] text-muted-fg cursor-not-allowed"
        )}
      >
        다음: 신분증 촬영 →
      </button>
    </div>
  );
}

function CheckItem({ check }: { check: (typeof mockWaitingChecks)[number] }) {
  const iconBg =
    check.status === "ok"
      ? "bg-[--color-success]"
      : check.status === "warn"
      ? "bg-[--color-warning]"
      : check.status === "error"
      ? "bg-[--color-danger]"
      : "bg-[--color-subtle]";
  const iconChar = check.status === "ok" ? "✓" : check.status === "pending" ? "…" : "!";
  return (
    <div className="flex items-center gap-3 border border-[--color-border] rounded-sm px-3 py-2.5">
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold",
          iconBg
        )}
      >
        {iconChar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-primary">{check.label}</div>
        <div className="text-[11px] text-muted-fg">{check.description}</div>
      </div>
      <div className="text-xs text-muted-fg font-tabular">{check.detail}</div>
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
      <div className="mb-6">
        <div className="text-[10px] font-semibold tracking-widest text-muted-fg uppercase mb-1.5">
          Step 2
        </div>
        <h2 className="mb-1">신분증 촬영·업로드</h2>
        <p className="text-sm text-muted-fg">
          본인 확인용 신분증 이미지가 필요합니다. 관리자가 시험 후 사후 검토합니다.
        </p>
      </div>

      <div className="mb-6 border border-[--color-warning] bg-[--color-warning-muted] rounded-sm px-4 py-3 text-xs leading-relaxed">
        <div className="font-semibold text-[--color-warning] mb-1">
          개인정보 처리 안내
        </div>
        <div className="text-muted-fg">
          업로드된 신분증 이미지는 응시자 본인 확인 목적으로만 사용되며, 시험 종료 후
          30일 이내 자동 파기됩니다. 자동 얼굴 인식(AWS Rekognition 등)은 사용하지
          않습니다.
        </div>
      </div>

      <div
        onClick={onUpload}
        className={cn(
          "border-2 border-dashed rounded-md p-10 text-center cursor-pointer transition",
          uploaded
            ? "border-[--color-success] bg-[--color-success-muted]"
            : "border-[--color-border-strong] hover:border-primary hover:surface-hover"
        )}
      >
        {uploaded ? (
          <>
            <div className="text-2xl mb-2">✓</div>
            <div className="text-sm font-semibold text-[--color-success]">
              업로드 완료 · id_ohjieun_240715.jpg
            </div>
            <div className="text-xs text-muted-fg mt-1">2.1 MB · 재업로드 클릭</div>
          </>
        ) : (
          <>
            <svg
              viewBox="0 0 24 24"
              className="w-10 h-10 mx-auto mb-3 text-muted-fg"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
              <circle cx="8.5" cy="10.5" r="2" />
              <path d="M4 17l4-4 4 4 4-4 4 4" />
            </svg>
            <div className="text-sm font-medium text-primary mb-1">
              신분증 이미지를 드래그하거나 클릭하여 업로드
            </div>
            <div className="text-xs text-muted-fg">
              주민등록증 · 운전면허증 · 여권 · 학생증 · JPG/PNG · 최대 10MB
            </div>
          </>
        )}
      </div>

      <button
        onClick={onContinue}
        disabled={!uploaded}
        className={cn(
          "mt-6 w-full h-11 rounded-sm text-sm font-semibold transition",
          uploaded
            ? "bg-primary text-primary-foreground hover:bg-[--color-primary-hover]"
            : "bg-[--color-subtle] text-muted-fg cursor-not-allowed"
        )}
      >
        다음: 보안 서약 →
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
      <div className="mb-6">
        <div className="text-[10px] font-semibold tracking-widest text-muted-fg uppercase mb-1.5">
          Step 3
        </div>
        <h2 className="mb-1">보안 서약</h2>
        <p className="text-sm text-muted-fg">
          시험 진행 및 감독 방침에 동의하셔야 응시가 가능합니다.
        </p>
      </div>

      <div className="border border-[--color-border] rounded-sm p-6 max-h-64 overflow-y-auto text-sm leading-relaxed text-primary space-y-4">
        <div>
          <div className="font-semibold mb-2">1. 감독 방식 안내</div>
          <p className="text-muted-fg">
            응시 중 웹캠·마이크·화면공유 스트림이 감독관에게 실시간 송출되며, 세션
            종료 시까지 Cloudflare R2에 녹화 저장됩니다. 얼굴·음성·전체화면 이탈 등은
            브라우저에서 자동 감지됩니다.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-2">2. 부정행위 금지 사항</div>
          <ul className="list-disc pl-5 text-muted-fg space-y-1">
            <li>타인 대리 응시 · 대화 · 통신 · 메모 참고</li>
            <li>웹캠·마이크·화면공유 임의 종료</li>
            <li>전체화면 5회 이상 이탈 시 자동 제출됨</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">3. 세트별 감독 유연화 안내</div>
          <p className="text-muted-fg">
            일부 문제 세트(작업형·외부 도구 허용)는 관리자 정책에 따라 감독이 일시
            비활성화됩니다. 해당 구간에는 별도 배너가 표시되며, 다른 세트로 이동 시
            감독이 자동 재활성화됩니다.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-2">4. 개인정보 처리</div>
          <p className="text-muted-fg">
            신분증 이미지 · 응시 녹화 · 감독 이벤트 로그는 시험 종료 후 30일 이내
            자동 파기됩니다. 이의 신청 절차는 사이트 정책을 따릅니다.
          </p>
        </div>
      </div>

      <label className="flex items-start gap-3 mt-6 p-4 border border-[--color-border-strong] rounded-sm cursor-pointer hover:surface-hover">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => onAgree(e.target.checked)}
          className="mt-0.5 accent-[--color-primary] w-4 h-4"
        />
        <div className="text-sm text-primary">
          위 내용을 모두 읽고 이해했으며, 부정행위 금지 및 감독 방침에 동의합니다.
          위반 시 응시 자격 박탈 및 향후 응시 제한에 이의를 제기하지 않겠습니다.
        </div>
      </label>

      <button
        onClick={onContinue}
        disabled={!agreed}
        className={cn(
          "mt-6 w-full h-11 rounded-sm text-sm font-semibold transition",
          agreed
            ? "bg-primary text-primary-foreground hover:bg-[--color-primary-hover]"
            : "bg-[--color-subtle] text-muted-fg cursor-not-allowed"
        )}
      >
        서약 완료 · 입실 대기 →
      </button>
    </div>
  );
}

/* ─────────── Step 4: 입실 대기 ─────────── */

function WaitingStep({ countdown }: { countdown: number }) {
  const canEnter = countdown < 3 * 60;
  return (
    <div className="text-center py-6">
      <div className="text-[10px] font-semibold tracking-widest text-muted-fg uppercase mb-1.5">
        Step 4
      </div>
      <h2 className="mb-1">입실 대기</h2>
      <p className="text-sm text-muted-fg mb-8">
        시험 시작 시각까지 대기해주세요.
      </p>

      <div className="inline-block border border-strong rounded-md px-16 py-8 mb-8">
        <div className="text-[10px] text-muted-fg tracking-widest mb-2">
          시작까지 남은 시간
        </div>
        <div className="font-tabular text-5xl font-bold text-primary">
          {formatTime(countdown)}
        </div>
      </div>

      <div className="max-w-md mx-auto text-sm text-muted-fg leading-relaxed mb-8">
        입실 허용 시간은 시험 시작 <b>3분 전</b>부터입니다. 그 이전에는 대기 상태로
        유지되며, 시간이 되면 자동으로 응시 페이지로 전환됩니다.
      </div>

      <Link
        href="/applicant/exam/session-me"
        className={cn(
          "inline-flex items-center justify-center h-11 px-8 rounded-sm text-sm font-semibold transition",
          canEnter
            ? "bg-primary text-primary-foreground hover:bg-[--color-primary-hover]"
            : "bg-[--color-subtle] text-muted-fg pointer-events-none cursor-not-allowed"
        )}
      >
        {canEnter ? "시험 입실 →" : "입실 대기중"}
      </Link>
    </div>
  );
}
