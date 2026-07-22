"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type IdentityStatus =
  | "none"
  | "selected"
  | "editing"
  | "uploading"
  | "uploaded"
  | "error";

type Mask = { x: number; y: number; w: number; h: number };

/**
 * 신분증 이미지 업로드 컴포넌트
 * - 응시자가 대기실 or 별도 스텝에서 사용
 * - JPG/PNG/WebP/HEIC · 최대 10MB
 * - 응시자가 직접 개인정보(주민번호 뒷자리 등)를 검정 사각형으로 마스킹한 뒤 업로드
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [masks, setMasks] = useState<Mask[]>([]);
  const [drag, setDrag] = useState<{
    startX: number;
    startY: number;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function chooseFile(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setMasks([]);
    setNaturalSize(null);
    setError(null);
    setStatus("selected");
  }

  function resetToChooser() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setMasks([]);
    setNaturalSize(null);
    setDrag(null);
    setStatus(path ? "uploaded" : "none");
  }

  function getPointer(e: React.PointerEvent) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0, dispW: 0, dispH: 0 };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      dispW: rect.width,
      dispH: rect.height,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!naturalSize) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = getPointer(e);
    setDrag({ startX: p.x, startY: p.y, x: p.x, y: p.y, w: 0, h: 0 });
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = getPointer(e);
    setDrag({
      startX: drag.startX,
      startY: drag.startY,
      x: Math.min(drag.startX, p.x),
      y: Math.min(drag.startY, p.y),
      w: Math.abs(p.x - drag.startX),
      h: Math.abs(p.y - drag.startY),
    });
  }

  function onPointerUp() {
    if (drag && naturalSize && wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const scaleX = naturalSize.w / rect.width;
      const scaleY = naturalSize.h / rect.height;
      if (drag.w > 6 && drag.h > 6) {
        setMasks((prev) => [
          ...prev,
          {
            x: drag.x * scaleX,
            y: drag.y * scaleY,
            w: drag.w * scaleX,
            h: drag.h * scaleY,
          },
        ]);
      }
    }
    setDrag(null);
  }

  async function saveAndUpload() {
    if (!selectedFile || !previewUrl || !naturalSize) return;
    setStatus("uploading");
    setError(null);
    try {
      // 원본 이미지 로드 후 마스크 합성
      const img = new Image();
      img.src = previewUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("이미지 로드 실패"));
      });

      const canvas = document.createElement("canvas");
      canvas.width = naturalSize.w;
      canvas.height = naturalSize.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 사용 불가");
      ctx.drawImage(img, 0, 0);
      ctx.fillStyle = "black";
      for (const m of masks) ctx.fillRect(m.x, m.y, m.w, m.h);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
      );
      if (!blob) throw new Error("이미지 변환 실패");
      const outFile = new File([blob], "identity.jpg", { type: "image/jpeg" });

      if (!sessionId) {
        // Practice · 저장하지 않고 미리보기만
        setError("Practice에서는 신분증이 저장되지 않습니다");
        setStatus("selected");
        return;
      }

      const form = new FormData();
      form.append("file", outFile);
      const res = await fetch("/api/exam/identity/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      setPath(data.path);
      setStatus("uploaded");
      onUploaded(data.path);
      // 편집 세션 정리
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setSelectedFile(null);
      setMasks([]);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "업로드 실패");
    }
  }

  const savedSrc =
    status === "uploaded" && path
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
        {(status === "selected" || status === "editing") && previewUrl && (
          <div className="space-y-3">
            {status === "editing" && (
              <div className="rounded-md border border-warning bg-warning-soft/60 text-warning text-[11px] font-bold px-3 py-2 leading-relaxed">
                주민등록번호 뒷자리 등 가리고 싶은 부분을 마우스로 드래그하면 검정 사각형으로 덮입니다.
              </div>
            )}
            <div
              ref={wrapperRef}
              onPointerDown={status === "editing" ? onPointerDown : undefined}
              onPointerMove={status === "editing" ? onPointerMove : undefined}
              onPointerUp={status === "editing" ? onPointerUp : undefined}
              onPointerCancel={status === "editing" ? onPointerUp : undefined}
              className={cn(
                "relative overflow-hidden rounded-md border border-border bg-black select-none touch-none mx-auto max-h-96",
                status === "editing" ? "cursor-crosshair" : "cursor-default"
              )}
              style={{ width: "fit-content" }}
            >
              <img
                src={previewUrl}
                alt="신분증 미리보기"
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
                }}
                className="block max-h-96 w-auto pointer-events-none"
              />
              {naturalSize &&
                masks.map((m, i) => (
                  <div
                    key={i}
                    className="absolute bg-black"
                    style={{
                      left: `${(m.x / naturalSize.w) * 100}%`,
                      top: `${(m.y / naturalSize.h) * 100}%`,
                      width: `${(m.w / naturalSize.w) * 100}%`,
                      height: `${(m.h / naturalSize.h) * 100}%`,
                    }}
                  >
                    {status === "editing" && (
                      <button
                        type="button"
                        onPointerDown={(ev) => ev.stopPropagation()}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          setMasks((prev) => prev.filter((_, j) => j !== i));
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-danger border border-danger text-[10px] font-bold flex items-center justify-center shadow"
                        aria-label="마스크 삭제"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              {drag && (
                <div
                  className="absolute bg-black/60 border border-white pointer-events-none"
                  style={{
                    left: `${drag.x}px`,
                    top: `${drag.y}px`,
                    width: `${drag.w}px`,
                    height: `${drag.h}px`,
                  }}
                />
              )}
            </div>

            {status === "selected" ? (
              <>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {masks.length > 0
                      ? `마스크 ${masks.length}개 적용됨`
                      : "마스킹 없음 · 필요시 편집을 눌러주세요"}
                  </span>
                  <button
                    type="button"
                    onClick={resetToChooser}
                    className="h-7 px-2 rounded-sm border border-border text-[11px] font-bold text-muted-foreground hover:text-primary hover:border-primary"
                  >
                    다른 사진 선택
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus("editing")}
                    className="h-11 rounded-md border border-primary bg-white text-primary text-sm font-bold hover:bg-primary-soft transition"
                  >
                    🖊 마스킹 편집
                  </button>
                  <button
                    type="button"
                    onClick={saveAndUpload}
                    disabled={!naturalSize}
                    className="h-11 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-50 transition"
                  >
                    ✓ 완료
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>마스크 {masks.length}개</span>
                  <div className="flex items-center gap-2">
                    {masks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMasks([])}
                        className="h-7 px-2 rounded-sm border border-border text-[11px] font-bold text-muted-foreground hover:text-danger hover:border-danger"
                      >
                        모두 지우기
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDrag(null);
                        setStatus("selected");
                      }}
                      className="h-7 px-2 rounded-sm border border-border text-[11px] font-bold text-muted-foreground hover:text-primary hover:border-primary"
                    >
                      ← 뒤로
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={saveAndUpload}
                  disabled={!naturalSize}
                  className="w-full h-11 rounded-md bg-primary text-white text-sm font-bold hover:bg-primary-hover disabled:opacity-50 transition"
                >
                  저장하고 업로드 →
                </button>
              </>
            )}
          </div>
        )}

        {status !== "selected" && status !== "editing" && savedSrc && (
          <div className="rounded-md border border-border overflow-hidden bg-black flex items-center justify-center">
            <img
              src={savedSrc}
              alt="신분증"
              className="max-h-64 w-auto object-contain"
            />
          </div>
        )}

        {status !== "selected" && status !== "editing" && (
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
                if (f) chooseFile(f);
                e.target.value = "";
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
        )}

        {error && (
          <div className="rounded-md bg-danger-soft border border-danger text-danger text-xs p-3">
            {error}
          </div>
        )}

        <div className="text-[10px] text-muted-foreground leading-relaxed">
          • 얼굴 사진 · 이름 · 발급기관이 선명하게 보이는 이미지여야 합니다
          <br />
          • 주민등록번호 뒷자리 등 개인정보는 마스킹 후 업로드하세요
          <br />
          • 관리자가 사후 검토합니다. 자동 매칭(얼굴 인식) 없음
          <br />
          • 개인정보 보호: 응시자 본인만 재확인 가능 · 감독관/관리자만 조회 · 시험 종료 후 보관 정책에 따라 삭제
        </div>
      </div>
    </div>
  );
}
