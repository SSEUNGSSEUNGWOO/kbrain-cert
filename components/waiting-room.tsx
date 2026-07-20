"use client";

import { useEffect, useState } from "react";
import { IdentityUpload } from "@/components/identity-upload";
import { useServerClock } from "@/lib/hooks/use-server-clock";
import { cn } from "@/lib/utils";

/**
 * 대기실 · 환경 체크 + 보안 서약 완료 후 진입
 * - 실 시험: scheduledAt까지 카운트다운 · 시간되면 자동 입장
 * - 테스트 링크(isPractice): 즉시 "입장하기" 버튼 · 시간 무관
 * - 신분증 이미지 업로드 필수 (실 시험만) · 미업로드 시 진입 차단
 */
export function WaitingRoom({
  exam,
  isPractice,
  scheduledAt,
  sessionId,
  initialIdentityPath,
  onEnter,
}: {
  exam: {
    title: string;
    durationMinutes: number;
    passScore: number;
    grade: string;
  };
  isPractice: boolean;
  scheduledAt?: Date;
  sessionId: string | null;
  initialIdentityPath: string | null;
  onEnter: () => void;
}) {
  const [identityPath, setIdentityPath] = useState<string | null>(
    initialIdentityPath
  );
  const identityReady = isPractice || !!identityPath;
  const canEnterImmediately = isPractice || scheduledAt == null;
  const { nowMs, synchronized } = useServerClock(
    !isPractice && scheduledAt != null
  );
  const remainingMs =
    scheduledAt && nowMs != null
      ? Math.max(0, scheduledAt.getTime() - nowMs)
      : null;
  const shouldAutoEnter =
    !isPractice &&
    scheduledAt != null &&
    synchronized &&
    remainingMs === 0 &&
    identityReady;

  useEffect(() => {
    if (shouldAutoEnter) onEnter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoEnter]);

  return (
    <div className="space-y-5">
      <div className="rounded-md bg-white border border-border p-6">
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
          Step 3 · 대기실
        </div>
        <h2>시험 준비 완료</h2>
        <p className="text-sm text-muted-foreground mt-2">
          환경 체크와 보안 서약이 모두 완료되었습니다.
          {isPractice
            ? " 테스트 링크는 언제든 입장할 수 있습니다."
            : " 시험 시작 시간이 되면 자동으로 시험창으로 이동합니다."}
        </p>
      </div>

      {/* 완료 체크리스트 */}
      <div className="rounded-md bg-white border border-border overflow-hidden">
        <ReadyRow
          n={1}
          label="환경 체크"
          detail="듀얼모니터 · 웹캠 · 화면공유 · 네트워크 · CPU · 브라우저"
        />
        <ReadyRow
          n={2}
          label="보안 서약"
          detail="7개 유의사항 모두 동의"
        />
        <ReadyRow
          n={3}
          label="시험 정보 확인"
          detail={`${exam.title} · ${exam.durationMinutes}분`}
        />
      </div>

      {/* 시험 정보 카드 */}
      <div className="rounded-md bg-white border border-border p-6">
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-3">
          응시할 시험
        </div>
        <div className="text-lg font-bold mb-4">{exam.title}</div>
        <div className="grid grid-cols-2 gap-3">
          <InfoBox label="등급" value={exam.grade} />
          <InfoBox label="시험 시간" value={`${exam.durationMinutes}분`} />
        </div>
      </div>

      {/* 신분증 이미지 업로드 · 실 시험이면 필수 */}
      <IdentityUpload
        sessionId={sessionId}
        initialPath={initialIdentityPath}
        onUploaded={(p) => setIdentityPath(p)}
      />

      {/* 입장 CTA · Practice면 즉시 · 실 시험이면 카운트다운 */}
      {canEnterImmediately ? (
        <div className="rounded-md bg-gradient-to-br from-primary to-primary-hover text-white p-6">
          <div className="text-[10px] font-bold tracking-widest opacity-80 uppercase mb-2">
            {isPractice ? "미리보기 · 대기 시간 없음" : "개별 시작 시험"}
          </div>
          <div className="text-2xl font-bold mb-1">언제든 입장 가능</div>
          <div className="text-xs opacity-80 mb-5">
            {isPractice
              ? "미리보기는 예약 시간과 관계없이 입장합니다."
              : "입장 시점부터 개인 시험 시간이 시작됩니다."}
          </div>
          <button
            onClick={onEnter}
            disabled={!identityReady}
            className="w-full h-14 rounded-md bg-white text-primary font-bold text-base hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 transition"
          >
            {identityReady ? "시험 입장하기 →" : "신분증 업로드 후 입장 가능"}
          </button>
        </div>
      ) : (
        <>
          <ScheduledCountdown
            remainingMs={remainingMs}
            scheduledAt={scheduledAt}
          />
          {!identityReady && (
            <div className="rounded-md bg-warning-soft border border-warning p-4 text-xs text-warning font-bold text-center">
              ⚠ 신분증 이미지를 먼저 업로드해야 시험이 시작됩니다
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReadyRow({
  n,
  label,
  detail,
}: {
  n: number;
  label: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-b-0">
      <div className="w-10 h-10 rounded-full bg-success text-white flex items-center justify-center font-bold text-sm shrink-0 font-tabular">
        ✓
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-muted mb-0.5 font-tabular tracking-widest">
          STEP {n}
        </div>
        <div className="text-sm font-bold">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{detail}</div>
      </div>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-surface-soft p-3">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className="text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

function ScheduledCountdown({
  remainingMs,
  scheduledAt,
}: {
  remainingMs: number | null;
  scheduledAt?: Date;
}) {
  const totalSec = Math.floor((remainingMs ?? 0) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div
      className={cn(
        "rounded-md p-6 text-white",
        remainingMs === 0
          ? "bg-success"
          : "bg-gradient-to-br from-primary to-primary-hover"
      )}
    >
      <div className="text-[10px] font-bold tracking-widest opacity-80 uppercase mb-2">
        {scheduledAt ? "시험 시작까지" : "시작 시간 정보 없음"}
      </div>
      <div className="text-5xl font-bold font-tabular tabular-nums mb-2">
        {remainingMs == null ? "동기화 중…" : `${pad(h)}:${pad(m)}:${pad(s)}`}
      </div>
      <div className="text-xs opacity-80">
        시간이 되면 자동으로 시험창으로 이동됩니다. 이 창을 닫지 마세요.
      </div>
    </div>
  );
}
