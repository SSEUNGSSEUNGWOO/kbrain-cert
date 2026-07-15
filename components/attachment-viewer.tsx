"use client";

import { useMemo, useState } from "react";
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

/**
 * 첨부 파일 다운로드 리스트
 * 파일 미리보기 없음 · 다운로드만 · 응시자는 로컬에서 열어봄
 */
export function AttachmentViewer({
  attachments,
  practiceSlug,
}: {
  attachments: Attachment[];
  practiceSlug?: string;
  block?: boolean; // 지금은 사용 X (CBT 보안 제거 · 다운로드 허용)
}) {
  const tree = useMemo(() => buildTree(attachments), [attachments]);

  if (attachments.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
        첨부 파일이 없습니다.
      </div>
    );
  }

  const totalSize = attachments.reduce((a, x) => a + x.size, 0);

  return (
    <div className="rounded-md border border-border bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-surface-soft flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-widest text-muted uppercase">
            첨부 자료 · 다운로드
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {attachments.length}개 파일 · 총 {formatSize(totalSize)}
          </div>
        </div>
        <DownloadAllButton
          attachments={attachments}
          practiceSlug={practiceSlug}
        />
      </div>
      <div className="p-2">
        <TreeView node={tree} depth={0} practiceSlug={practiceSlug} />
      </div>
    </div>
  );
}

function TreeView({
  node,
  depth,
  practiceSlug,
}: {
  node: TreeNode;
  depth: number;
  practiceSlug?: string;
}) {
  return (
    <div>
      {node.children.map((c) => {
        if (c.attachment) {
          return (
            <FileRow
              key={c.fullName}
              attachment={c.attachment}
              depth={depth}
              practiceSlug={practiceSlug}
            />
          );
        }
        return (
          <FolderNode
            key={c.fullName}
            node={c}
            depth={depth}
            practiceSlug={practiceSlug}
          />
        );
      })}
    </div>
  );
}

function FolderNode({
  node,
  depth,
  practiceSlug,
}: {
  node: TreeNode;
  depth: number;
  practiceSlug?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-1.5 px-2 hover:bg-surface-soft rounded-sm text-[11px] font-bold tracking-widest text-muted uppercase"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="text-muted-foreground text-[10px] w-3">
          {open ? "▾" : "▸"}
        </span>
        <span>{node.name}</span>
        <span className="text-[10px] text-muted-foreground ml-auto normal-case font-normal tracking-normal">
          {countFiles(node)}개
        </span>
      </button>
      {open && (
        <TreeView node={node} depth={depth + 1} practiceSlug={practiceSlug} />
      )}
    </div>
  );
}

function countFiles(node: TreeNode): number {
  let n = 0;
  for (const c of node.children) {
    if (c.attachment) n++;
    else n += countFiles(c);
  }
  return n;
}

function FileRow({
  attachment,
  depth,
  practiceSlug,
}: {
  attachment: Attachment;
  depth: number;
  practiceSlug?: string;
}) {
  const filename = attachment.name.split("/").pop() ?? attachment.name;
  const qs = new URLSearchParams();
  if (practiceSlug) qs.set("practice", practiceSlug);
  qs.set("download", filename);
  const href = `/api/attachments/${attachment.path}?${qs.toString()}`;
  return (
    <div
      className="flex items-center gap-2 py-1.5 px-2 hover:bg-surface-soft rounded-sm"
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <FileIcon mime={attachment.mime} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate">
          {filename}
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground font-tabular whitespace-nowrap">
        {formatSize(attachment.size)}
      </span>
      <a
        href={href}
        download={filename}
        className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm bg-primary hover:bg-primary-hover text-white text-[10px] font-bold tracking-wide transition"
      >
        ↓ 다운로드
      </a>
    </div>
  );
}

function DownloadAllButton({
  attachments,
  practiceSlug,
}: {
  attachments: Attachment[];
  practiceSlug?: string;
}) {
  const [downloading, setDownloading] = useState(false);
  const handleClick = async () => {
    if (downloading) return;
    setDownloading(true);
    // 각 파일을 순차적으로 다운로드 트리거
    for (const att of attachments) {
      const filename = att.name.split("/").pop() ?? att.name;
      const qs = new URLSearchParams();
      if (practiceSlug) qs.set("practice", practiceSlug);
      qs.set("download", filename);
      const url = `/api/attachments/${att.path}?${qs.toString()}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise((r) => setTimeout(r, 200));
    }
    setDownloading(false);
  };
  return (
    <button
      onClick={handleClick}
      disabled={downloading}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-sm bg-white border border-border hover:border-primary text-xs font-bold transition disabled:opacity-50"
    >
      {downloading ? "다운로드 중…" : "전체 다운로드"}
    </button>
  );
}

function FileIcon({ mime }: { mime: string }) {
  const style = "text-sm w-4 text-center shrink-0";
  if (mime.startsWith("image/"))
    return <span className={cn(style, "text-info")}>◧</span>;
  if (mime === "text/csv")
    return <span className={cn(style, "text-success")}>☰</span>;
  if (mime === "application/json")
    return <span className={cn(style, "text-warning")}>{"{}"}</span>;
  if (mime === "text/markdown")
    return <span className={cn(style, "text-primary")}>¶</span>;
  if (mime === "application/zip")
    return <span className={cn(style, "text-warning")}>⌸</span>;
  return <span className={cn(style, "text-muted")}>·</span>;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
