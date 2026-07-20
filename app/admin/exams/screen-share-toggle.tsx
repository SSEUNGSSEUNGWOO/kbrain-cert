"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ScreenShareToggle({
  examId,
  allowNoScreenShare,
}: {
  examId: string;
  allowNoScreenShare: boolean;
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
        body: JSON.stringify({ allowNoScreenShare: checked }),
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
    <div className="mt-2">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <input
          type="checkbox"
          checked={allowNoScreenShare}
          disabled={busy}
          onChange={(event) => void change(event.target.checked)}
          className="h-4 w-4 accent-primary"
        />
        화면 공유 없이 응시 허용
      </label>
      {error && <p className="mt-1 text-[10px] font-bold text-danger">{error}</p>}
    </div>
  );
}
