"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type IdentityStatus = "none" | "uploaded" | "uploading" | "error";

/**
 * 신분증 이미지 업로드 컴포넌트
 * - 응시자가 대기실 or 별도 스텝에서 사용
 * - JPG/PNG/WebP/HEIC · 최대 10MB
 * - 관리자 사후 검토 (Rekognition 미사용)
 * - Practice(sessionId 없음)에서는 저장되지 않는다는 안내
 */
export function IdentityUpload({
  sessionId,
  initialPath,
  onUploaded,
}: {
  sessionId: string | null;
  initialPath: string | null;
  onUploaded: (path: string) => void;
}) {
  const [path, setPath] = useState<string | null>(initialPath);
  const [status, setStatus] = useState<IdentityStatus>(
    initialPath ? "uploaded" : "none"
  );
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (!sessionId) {
      setError("Practice에서는 신분증이 저장되지 않습니다");
      // 로컬 미리보기만 보여줌
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }
    setStatus("uploading");
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/exam/identity/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      setPath(data.path);
      setStatus("uploaded");
      onUploaded(data.path);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "업로드 실패");
    }
  }

  const imageSrc = previewUrl
    ? previewUrl
    : path
    ? `/api/exam/identity/image/${path}`
    : null;

  return (
    <div className="rounded-md bg-white border border-border overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-warning text-white flex items-center justify-center text-xs font-bold">
          🪪
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold tracking-widest text-warning uppercase">
            Identity · 신분증 확인
          </div>
          <div className="text-xs text-muted-foreground">
            사진이 부착된 신분증(주민등록증 · 운전면허증 · 여권 등) 이미지를 업로드해주세요
          </div>
        </div>
        {status === "uploaded" && (
          <span className="text-[10px] font-bold text-success bg-success-soft px-2 py-0.5 rounded-sm">
            ✓ 업로드 완료
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {imageSrc && (
          <div className="rounded-md border border-border overflow-hidden bg-black flex items-center justify-center">
            <img
              src={imageSrc}
              alt="신분증"
              className="max-h-64 w-auto object-contain"
            />
          </div>
        )}

        <label
          className={cn(
            "rounded-md border-2 border-dashed py-6 px-4 text-center text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition",
            status === "uploading"
              ? "border-border bg-surface-soft text-muted"
              : status === "uploaded"
              ? "border-success/50 bg-success-soft/20 text-success hover:border-success"
              : "border-border-strong bg-surface-soft text-muted-foreground hover:border-primary hover:text-primary"
          )}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
            disabled={status === "uploading"}
            className="hidden"
          />
          <div className="text-2xl">
            {status === "uploaded" ? "✓" : "📷"}
          </div>
          <div className="font-bold">
            {status === "uploading"
              ? "업로드 중…"
              : status === "uploaded"
              ? "다른 이미지로 다시 업로드"
              : "신분증 이미지 선택"}
          </div>
          <div className="text-[10px]">
            JPG · PNG · WebP · HEIC · 최대 10MB
          </div>
          {!sessionId && (
            <div className="text-[10px] text-warning font-bold">
              Practice · 저장되지 않음
            </div>
          )}
        </label>

        {error && (
          <div className="rounded-md bg-danger-soft border border-danger text-danger text-xs p-3">
            {error}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground leading-relaxed">
          • 얼굴 사진 · 이름 · 발급기관이 선명하게 보이는 이미지여야 합니다
          <br />
          • 관리자가 사후 검토합니다. 자동 매칭(얼굴 인식) 없음
          <br />
          • 개인정보 보호: 응시자 본인만 재확인 가능 · 감독관/관리자만 조회 · 시험 종료 후 보관 정책에 따라 삭제
        </div>
      </div>
    </div>
  );
}
