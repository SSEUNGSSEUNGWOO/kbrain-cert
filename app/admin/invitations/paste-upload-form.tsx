"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseInvitationPaste } from "@/lib/csv-parse";

type ExamOption = { id: string; title: string };

export function PasteUploadButton({ exams }: { exams: ExamOption[] }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        disabled={exams.length === 0}
        className="h-9 px-4 rounded-md bg-white border border-border hover:border-primary text-xs font-bold transition disabled:opacity-50"
      >
        + 엑셀 붙여넣기
      </button>
    );
  }
  return <PasteUploadModal exam={exams[0]} onClose={() => setOpen(false)} />;
}

function PasteUploadModal({
  exam,
  onClose,
}: {
  exam: ExamOption;
  onClose: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { rows, errors } = useMemo(() => parseInvitationPaste(text), [text]);

  async function upload() {
    if (rows.length === 0 || errors.length > 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/invitations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examId: exam.id, rows }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? "이미 등록된 이름·전화번호 뒷자리 조합이 있습니다."
            : data.error ?? "등록 실패"
        );
      }
      setMessage(`${data.created?.length ?? 0}명 등록 완료`);
      setText("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "등록 실패");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="rounded-md bg-white border border-border w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-widest text-primary uppercase">
              {exam.title}
            </div>
            <h3 className="font-bold">엑셀 명단 붙여넣기</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-muted-foreground hover:text-foreground text-xl"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-md bg-surface-soft p-3 text-xs text-muted-foreground">
            엑셀에서 이름·전화번호 두 열을 선택해 복사한 뒤 아래에 붙여넣으세요.
          </div>
          <textarea
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setMessage(null);
            }}
            rows={10}
            autoFocus
            placeholder={"홍길동\t010-1234-5678\n김철수\t010-9876-5432"}
            className="w-full rounded-md border border-border p-3 text-sm font-tabular focus:border-primary focus:outline-none"
          />

          {errors.length > 0 && (
            <div className="rounded-md bg-danger-soft border border-danger p-3 text-xs text-danger">
              {errors.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <div className="px-3 py-2 bg-surface-soft text-xs font-bold">
                등록 예정 {rows.length}명
              </div>
              <div className="max-h-48 overflow-auto divide-y divide-border">
                {rows.map((row, index) => (
                  <div
                    key={`${row.name}-${row.phone}-${index}`}
                    className="grid grid-cols-2 px-3 py-2 text-xs"
                  >
                    <span className="font-bold">{row.name}</span>
                    <span className="font-tabular">{row.phone}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {message && (
            <div className="rounded-md bg-info-soft p-3 text-xs font-bold text-info">
              {message}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-md border border-border text-sm font-bold"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={() => void upload()}
              disabled={busy || rows.length === 0 || errors.length > 0}
              className="flex-1 h-10 rounded-md bg-primary text-white text-sm font-bold disabled:opacity-50"
            >
              {busy ? "등록 중…" : `${rows.length}명 등록`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
