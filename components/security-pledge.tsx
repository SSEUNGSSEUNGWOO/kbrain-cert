"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const PLEDGE_ITEMS = [
  "본인이 직접 응시하며, 대리 응시 등 부정행위를 하지 않겠습니다.",
  "시험 시간 중 자리를 이탈하지 않으며, 얼굴이 항상 카메라에 잡히도록 하겠습니다.",
  "본인 외 다른 사람이 카메라 시야에 잡히지 않도록 하겠습니다.",
  "외부 자료(책·웹 검색·AI·타 프로그램·휴대전화 등)를 참조하지 않겠습니다.",
  "시험 화면을 촬영·녹화·캡처하지 않으며, 어떤 방식으로도 외부에 공유하지 않겠습니다.",
  "시험 문항·답안·결과를 외부에 공개·유출하지 않겠습니다.",
  "감독관의 지시에 성실히 따르며, 위반 시 시험이 무효 처리됨에 동의합니다.",
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
          아래 각 항목을 반드시 읽고 체크해주세요. 위반이 감지되면 시험이 즉시 무효 처리되며, 자격 취득이 제한됩니다.
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
