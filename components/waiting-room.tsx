"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * 대기실 · 환경 체크 + 보안 서약 완료 후 진입
 * - 실 시험: scheduledAt까지 카운트다운 · 시간되면 자동 입장
 * - 테스트 링크(isPractice): 즉시 "입장하기" 버튼 · 시간 무관
 */
export function WaitingRoom({
  exam,
  isPractice,
  scheduledAt,
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
  onEnter: () => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (isPractice || !scheduledAt) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [isPractice, scheduledAt]);

  const remainingMs = scheduledAt
    ? Math.max(0, scheduledAt.getTime() - now.getTime())
    : 0;
  const shouldAutoEnter =
    !isPractice && scheduledAt != null && remainingMs === 0;

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
          detail={`${exam.title} · ${exam.durationMinutes}분 · 합격 ${exam.passScore}점`}
        />
      </div>

      {/* 시험 정보 카드 */}
      <div className="rounded-md bg-white border border-border p-6">
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-3">
          응시할 시험
        </div>
        <div className="text-lg font-bold mb-4">{exam.title}</div>
        <div className="grid grid-cols-3 gap-3">
          <InfoBox label="등급" value={exam.grade} />
          <InfoBox label="시험 시간" value={`${exam.durationMinutes}분`} />
          <InfoBox label="합격 기준" value={`${exam.passScore}점 이상`} />
        </div>
      </div>

      {/* 입장 CTA · Practice면 즉시 · 실 시험이면 카운트다운 */}
      {isPractice ? (
        <div className="rounded-md bg-gradient-to-br from-primary to-primary-hover text-white p-6">
          <div className="text-[10px] font-bold tracking-widest opacity-80 uppercase mb-2">
            테스트 링크 · 대기 시간 없음
          </div>
          <div className="text-2xl font-bold mb-1">언제든 입장 가능</div>
          <div className="text-xs opacity-80 mb-5">
            실 시험에서는 정해진 시작 시간까지 자동으로 대기합니다.
          </div>
          <button
            onClick={onEnter}
            className="w-full h-14 rounded-md bg-white text-primary font-bold text-base hover:bg-white/90 transition"
          >
            시험 입장하기 →
          </button>
        </div>
      ) : (
        <ScheduledCountdown
          remainingMs={remainingMs}
          scheduledAt={scheduledAt}
        />
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
  remainingMs: number;
  scheduledAt?: Date;
}) {
  const totalSec = Math.floor(remainingMs / 1000);
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
        {pad(h)}:{pad(m)}:{pad(s)}
      </div>
      <div className="text-xs opacity-80">
        시간이 되면 자동으로 시험창으로 이동됩니다. 이 창을 닫지 마세요.
      </div>
    </div>
  );
}
