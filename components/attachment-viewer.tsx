"use client";

export type Attachment = {
  name: string; // 원본 이름 (다운로드 파일명 · 예: "1과목_자료묶음.zip")
  path: string; // Storage key
  mime: string;
  size: number;
  entries?: number; // zip인 경우 안의 파일 개수 (안내용)
};

/**
 * 첨부 자료 다운로드 카드
 * - 세트별 자료묶음 zip 하나만 표시
 * - 응시자는 로컬에 unzip 후 폴더 구조 그대로 시나리오와 매칭
 * - Practice: ?practice=<slug>로 인증
 * - 실 시험: 세션 쿠키(kbrain_exam_session)로 서버 인증 (query 없음)
 */
export function AttachmentViewer({
  attachments,
  practiceSlug,
}: {
  attachments: Attachment[];
  practiceSlug?: string;
}) {
  if (attachments.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        첨부 자료가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {attachments.map((att) => (
        <ZipCard key={att.path} attachment={att} practiceSlug={practiceSlug} />
      ))}
    </div>
  );
}

function ZipCard({
  attachment,
  practiceSlug,
}: {
  attachment: Attachment;
  practiceSlug?: string;
}) {
  const qs = new URLSearchParams();
  if (practiceSlug) qs.set("practice", practiceSlug);
  qs.set("download", attachment.name);
  const href = `/api/attachments/${attachment.path}?${qs.toString()}`;

  return (
    <div className="rounded-md border border-border bg-white p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-md bg-primary-soft text-primary flex items-center justify-center text-xl font-bold shrink-0">
        ⌸
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm text-foreground truncate">
          {attachment.name}
        </div>
        <div className="text-xs text-muted-foreground font-tabular mt-0.5">
          {formatSize(attachment.size)}
          {attachment.entries != null && (
            <span> · 파일 {attachment.entries}개</span>
          )}
          <span className="ml-2">· zip 압축</span>
        </div>
      </div>
      <a
        href={href}
        download={attachment.name}
        className="inline-flex items-center gap-1.5 h-10 px-4 rounded-md bg-primary hover:bg-primary-hover text-white text-sm font-bold transition shrink-0"
      >
        ↓ 다운로드
      </a>
    </div>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
