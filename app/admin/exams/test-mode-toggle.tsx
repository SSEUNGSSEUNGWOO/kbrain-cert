"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TestModeToggle({
  examId,
  isTestMode,
}: {
  examId: string;
  isTestMode: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(checked: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/exams/${examId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTestMode: checked }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "저장 실패");
      router.refresh();
    } catch (changeError) {
      setError(
        changeError instanceof Error ? changeError.message : "저장 실패"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
        <input
          type="checkbox"
          checked={isTestMode}
          disabled={busy}
          onChange={(event) => void change(event.target.checked)}
          className="w-4 h-4 accent-primary"
        />
        테스트 시험 · 공용 링크로 반복 응시
      </label>
      {error && <p className="mt-1 text-[10px] font-bold text-danger">{error}</p>}
    </div>
  );
}
