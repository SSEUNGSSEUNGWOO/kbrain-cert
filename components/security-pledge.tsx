"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const PLEDGE_ITEMS = [
  "시험 중 허용되지 않은 외부 프로그램·웹사이트·메신저 등을 사용하는 행위",
  "다른 응시자와 답안을 공유하거나 제3자의 도움을 받아 답안을 작성하는 행위",
  "시험 화면·문항·답안을 촬영·캡처·녹화하거나 외부로 유출하는 행위",
  "대리 응시 등 본인이 아닌 자가 대신 시험을 치르는 행위",
  "감독 기능(웹캠·화면공유 등)을 고의로 비활성화하거나 방해하는 행위",
  "시험 전·중·후 문항 내용과 답안을 타인과 공유하거나 논의하는 행위",
  "기타 공정한 시험 운영을 저해하는 일체의 부정행위",
];

export function SecurityPledge({ onProceed }: { onProceed: () => void }) {
  const [checked, setChecked] = useState<boolean[]>(
    Array(PLEDGE_ITEMS.length).fill(false)
  );
  const okCount = checked.filter(Boolean).length;
  const allChecked = okCount === PLEDGE_ITEMS.length;

  return (
    <div className="space-y-5">
      <div className="rounded-md bg-white border border-border p-6">
        <div className="text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
          Step 2 · 보안 서약 및 유의사항
        </div>
        <h2>시험 응시 전 필독</h2>
        <p className="text-sm text-muted-foreground mt-2">
          다음 부정행위 예시를 확인하고 각 항목에 동의해 주세요. 위반 사실이 확인되면 시험이 즉시 무효 처리되며 자격 취득이 제한됩니다.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-2 bg-subtle rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                allChecked ? "bg-success" : "bg-primary"
              )}
              style={{ width: `${(okCount / PLEDGE_ITEMS.length) * 100}%` }}
            />
          </div>
          <div className="text-xs font-bold font-tabular text-muted-foreground">
            {okCount} / {PLEDGE_ITEMS.length}
          </div>
        </div>
      </div>

      <div className="rounded-md bg-white border border-border overflow-hidden">
        {PLEDGE_ITEMS.map((item, i) => {
          const isChecked = checked[i];
          return (
            <label
              key={i}
              className={cn(
                "flex items-start gap-4 px-5 py-4 border-b border-border last:border-b-0 cursor-pointer transition",
                isChecked ? "bg-success-soft/40" : "hover:bg-surface-soft"
              )}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => {
                  const next = [...checked];
                  next[i] = e.target.checked;
                  setChecked(next);
                }}
                className="mt-1 w-5 h-5 accent-primary shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-muted mb-0.5 font-tabular tracking-widest">
                  ITEM {String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-sm text-foreground leading-relaxed">
                  {item}
                </div>
              </div>
              {isChecked && (
                <span className="mt-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-success text-white text-[10px] font-bold shrink-0">
                  ✓
                </span>
              )}
            </label>
          );
        })}
      </div>

      <div
        className={cn(
          "rounded-md p-5 border-2",
          allChecked
            ? "border-success bg-success-soft"
            : "border-warning bg-warning-soft"
        )}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "w-10 h-10 rounded-sm flex items-center justify-center font-bold text-lg",
              allChecked ? "bg-success text-white" : "bg-warning text-white"
            )}
          >
            {allChecked ? "✓" : "!"}
          </div>
          <div className="flex-1">
            <div
              className={cn(
                "font-bold text-sm",
                allChecked ? "text-success" : "text-warning"
              )}
            >
              {allChecked ? "모든 항목 동의 완료" : "일부 항목 미동의"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {allChecked
                ? "대기실로 이동해서 시험 시작을 기다려주세요."
                : `아직 ${PLEDGE_ITEMS.length - okCount}개 항목이 남았습니다.`}
            </div>
          </div>
        </div>

        <button
          onClick={onProceed}
          disabled={!allChecked}
          className={cn(
            "w-full h-14 rounded-md font-bold text-base transition",
            allChecked
              ? "bg-primary hover:bg-primary-hover text-white shadow-sm"
              : "bg-subtle text-muted cursor-not-allowed"
          )}
        >
          {allChecked
            ? "동의하고 대기실로 이동 →"
            : `모든 항목에 동의해야 진행 가능`}
        </button>
      </div>
    </div>
  );
}
