"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type Attachment = {
  name: string; // 원본 경로 (예: "보도자료/1차분/보도자료_125874.md")
  path: string; // Storage key (hash 기반)
  mime: string;
  size: number;
};

type TreeNode = {
  name: string; // 표시 이름 (해당 노드만)
  fullName: string; // 전체 경로
  attachment?: Attachment; // 파일이면 있음
  children: TreeNode[];
};

function buildTree(attachments: Attachment[]): TreeNode {
  const root: TreeNode = { name: "", fullName: "", children: [] };
  for (const att of attachments) {
    const parts = att.name.split("/");
    let node = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      const isLeaf = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          fullName: acc,
          children: [],
          attachment: isLeaf ? att : undefined,
        };
        node.children.push(child);
      }
      node = child;
    }
  }
  // sort folders first
  const sortRec = (n: TreeNode) => {
    n.children.sort((a, b) => {
      if (a.children.length && !b.children.length) return -1;
      if (!a.children.length && b.children.length) return 1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

export function AttachmentViewer({
  attachments,
  block = false,
  practiceSlug,
}: {
  attachments: Attachment[];
  block?: boolean; // true면 CBT 보안 (우클릭·복사·저장 차단)
  practiceSlug?: string; // 있으면 파일 URL에 ?practice=slug 붙여 인증 우회
}) {
  const tree = useMemo(() => buildTree(attachments), [attachments]);
  const [selected, setSelected] = useState<Attachment | null>(
    attachments[0] ?? null
  );

  // CBT 보안 이벤트 리스너
  useEffect(() => {
    if (!block) return;
    const onContext = (e: MouseEvent) => e.preventDefault();
    const onKey = (e: KeyboardEvent) => {
      // F12 · Ctrl+S · Ctrl+P · Ctrl+U · Ctrl+Shift+I/C
      if (e.key === "F12") return e.preventDefault();
      const meta = e.ctrlKey || e.metaKey;
      if (meta && ["s", "S", "p", "P", "u", "U"].includes(e.key))
        return e.preventDefault();
      if (meta && e.shiftKey && ["I", "J", "C", "i", "j", "c"].includes(e.key))
        return e.preventDefault();
    };
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey);
    };
  }, [block]);

  if (attachments.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        첨부 파일이 없습니다.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-md border border-border bg-white overflow-hidden",
        block && "select-none"
      )}
      style={block ? { WebkitUserSelect: "none" } : undefined}
    >
      <div className="flex" style={{ minHeight: 400 }}>
        {/* 좌측 파일 트리 */}
        <aside className="w-64 shrink-0 border-r border-border bg-surface-soft overflow-y-auto">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-[10px] font-bold tracking-widest text-muted uppercase">
              첨부 자료
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {attachments.length}개 파일 · 다운로드 불가
            </div>
          </div>
          <div className="p-2">
            <TreeView
              node={tree}
              depth={0}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        </aside>

        {/* 우측 뷰어 */}
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
          {selected ? (
            <FileViewer
              key={selected.path}
              attachment={selected}
              practiceSlug={practiceSlug}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              좌측에서 파일을 선택하세요
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function TreeView({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selected: Attachment | null;
  onSelect: (a: Attachment) => void;
}) {
  return (
    <div>
      {node.children.map((c) => {
        if (c.attachment) {
          const isSel = selected?.path === c.attachment.path;
          return (
            <button
              key={c.fullName}
              onClick={() => onSelect(c.attachment!)}
              className={cn(
                "w-full text-left flex items-center gap-2 py-1.5 px-2 rounded-sm text-xs transition truncate",
                isSel
                  ? "bg-primary text-white font-bold"
                  : "text-foreground hover:bg-white"
              )}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <FileIcon mime={c.attachment.mime} />
              <span className="flex-1 truncate">{c.name}</span>
            </button>
          );
        }
        return (
          <div key={c.fullName}>
            <div
              className="flex items-center gap-2 py-1.5 px-2 text-[10px] font-bold tracking-widest text-muted uppercase"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <span className="text-muted">▸</span>
              <span>{c.name}</span>
            </div>
            <TreeView
              node={c}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
            />
          </div>
        );
      })}
    </div>
  );
}

function FileIcon({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <span className="text-info">◧</span>;
  if (mime === "text/csv") return <span className="text-success">☰</span>;
  if (mime === "application/json") return <span className="text-warning">{"{}"}</span>;
  if (mime === "text/markdown") return <span className="text-primary">¶</span>;
  return <span className="text-muted">·</span>;
}

/* ─────────── 파일 렌더러 ─────────── */

function FileViewer({
  attachment,
  practiceSlug,
}: {
  attachment: Attachment;
  practiceSlug?: string;
}) {
  const baseQs = practiceSlug ? `?practice=${practiceSlug}` : "";
  const src = `/api/attachments/${attachment.path}${baseQs}`;

  // 다운로드 URL (원본 파일명은 name의 마지막 세그먼트만 · 폴더 경로 제거)
  const filename = attachment.name.split("/").pop() ?? attachment.name;
  const dlQs = new URLSearchParams();
  if (practiceSlug) dlQs.set("practice", practiceSlug);
  dlQs.set("download", filename);
  const downloadHref = `/api/attachments/${attachment.path}?${dlQs.toString()}`;

  const isImage = attachment.mime.startsWith("image/");
  const isCsv = attachment.mime === "text/csv";
  const isJson = attachment.mime === "application/json";
  const isMd = attachment.mime === "text/markdown";
  const isText = attachment.mime.startsWith("text/") || isJson;

  return (
    <>
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-surface-soft gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold truncate">{attachment.name}</div>
          <div className="text-[10px] text-muted-foreground font-tabular">
            {attachment.mime} · {formatSize(attachment.size)}
          </div>
        </div>
        <a
          href={downloadHref}
          download={filename}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-primary hover:bg-primary-hover text-white text-[11px] font-bold transition"
        >
          <span>↓</span>
          다운로드
        </a>
      </div>

      <div className="flex-1 overflow-auto p-5 max-h-[520px]">
        {isImage && <ImageView src={src} />}
        {isCsv && <TextTable src={src} />}
        {(isJson || isMd || (isText && !isCsv)) && (
          <TextPreview src={src} language={isJson ? "json" : isMd ? "md" : "text"} />
        )}
        {!isImage && !isCsv && !isText && (
          <div className="text-sm text-muted-foreground text-center py-10">
            이 형식은 브라우저에서 미리보기가 지원되지 않습니다. ({attachment.mime})
            <div className="mt-3">
              <a
                href={downloadHref}
                download={filename}
                className="text-primary font-bold hover:underline"
              >
                다운로드해서 열어보세요 →
              </a>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/* ─────── 이미지 뷰어 (다운로드 방지) ─────── */

function ImageView({ src }: { src: string }) {
  return (
    <div className="flex items-center justify-center">
      <img
        src={src}
        alt=""
        className="max-w-full max-h-[480px] object-contain"
      />
    </div>
  );
}

/* ─────── 텍스트 프리뷰 (마크다운·JSON·기타) ─────── */

function TextPreview({ src, language }: { src: string; language: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(null);
    setError(null);
    fetch(src)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(setContent)
      .catch((err) => setError(err.message));
  }, [src]);

  if (error)
    return (
      <div className="text-sm text-danger font-tabular">
        로드 실패: {error}
      </div>
    );
  if (content === null)
    return <div className="text-xs text-muted-foreground">로딩…</div>;

  return (
    <pre
      className="text-xs font-tabular whitespace-pre-wrap break-all leading-relaxed text-foreground"
      data-language={language}
    >
      {content}
    </pre>
  );
}

/* ─────── CSV → 표 렌더러 ─────── */

function TextTable({ src }: { src: string }) {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    fetch(src)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then((text) => setRows(parseCsv(text)))
      .catch((err) => setError(err.message));
  }, [src]);

  if (error)
    return (
      <div className="text-sm text-danger font-tabular">
        로드 실패: {error}
      </div>
    );
  if (rows === null)
    return <div className="text-xs text-muted-foreground">로딩…</div>;
  if (rows.length === 0)
    return <div className="text-xs text-muted-foreground">빈 CSV</div>;

  const [header, ...body] = rows;

  return (
    <div className="overflow-auto max-h-[480px]">
      <div className="text-[10px] text-muted-foreground mb-2 font-tabular">
        {body.length}행 · {header.length}열
      </div>
      <table className="w-full text-xs font-tabular border-collapse">
        <thead className="bg-surface-soft sticky top-0">
          <tr>
            {header.map((h, i) => (
              <th
                key={i}
                className="text-left px-2 py-1.5 border border-border font-bold text-primary whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="hover:bg-surface-hover">
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-2 py-1 border border-border text-foreground whitespace-nowrap"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 최소 CSV 파서 (RFC 4180 quote 처리)
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cell += c;
      }
    } else {
      if (c === '"') inQuote = true;
      else if (c === ",") {
        row.push(cell);
        cell = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else {
        cell += c;
      }
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}
