/**
 * 실전세트01·블루 첨부 파일 업로드
 * - Downloads/1세트_정책모니터링/{과목}/첨부/*.zip 을 unzip
 * - Supabase Storage bucket 'exam-attachments'에 개별 파일 업로드
 * - 각 question_sets.attachments jsonb 갱신 (파일 트리)
 *
 * 실행: node --env-file=.env.local scripts/upload-attachments.mjs
 */
import { createClient } from "@supabase/supabase-js";
import AdmZip from "adm-zip";
import mime from "mime-types";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

// Supabase Storage는 key에 ASCII만 허용 → 한글 경로 hash로 대체
function safeKey(relPath) {
  const ext = path.extname(relPath);
  const hash = crypto.createHash("md5").update(relPath).digest("hex").slice(0, 12);
  return `${hash}${ext}`;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "exam-attachments";

// 1. bucket 생성 (idempotent)
console.log(`[1] Ensuring bucket "${BUCKET}"...`);
const { data: buckets } = await supabase.storage.listBuckets();
const exists = buckets?.some((b) => b.name === BUCKET);
if (!exists) {
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false, // ⚠️ private · service_role만 read 가능
    fileSizeLimit: 50 * 1024 * 1024, // 50MB
  });
  if (error) {
    console.error("Bucket create error:", error.message);
    process.exit(1);
  }
  console.log(`  ✓ Bucket created`);
} else {
  console.log(`  ✓ Bucket already exists`);
}

// 2. 각 set에 대해 zip unzip + 파일 업로드
const BASE_DIR = "C:/Users/USER/Downloads/1세트_정책모니터링";
const setsConfig = [
  {
    setTitle: "1과목 · 콘텐츠",
    folder: "1과목_콘텐츠",
    zip: "1과목_자료묶음.zip",
    storagePrefix: "exam-blue-1/set-1",
  },
  {
    setTitle: "2과목 · 데이터분석",
    folder: "2과목_데이터분석",
    zip: "2과목_자료묶음.zip",
    storagePrefix: "exam-blue-1/set-2",
  },
  {
    setTitle: "3과목 · 자동화",
    folder: "3과목_자동화",
    zip: "3과목_자료묶음.zip",
    storagePrefix: "exam-blue-1/set-3",
  },
];

const attachmentsBySet = {};

for (const cfg of setsConfig) {
  const zipPath = path.join(BASE_DIR, cfg.folder, "첨부", cfg.zip);
  if (!fs.existsSync(zipPath)) {
    console.error(`  ✗ Zip not found: ${zipPath}`);
    continue;
  }
  console.log(`\n[2] Processing ${cfg.setTitle}...`);
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  console.log(`  Found ${entries.length} files in ${cfg.zip}`);

  const attachments = [];
  for (const entry of entries) {
    const relPath = entry.entryName; // e.g. "보도자료/1차분/보도자료_125874.md"
    const storagePath = `${cfg.storagePrefix}/${safeKey(relPath)}`;
    const buffer = entry.getData();
    const contentType =
      mime.lookup(entry.entryName) || "application/octet-stream";

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: true,
      });

    if (error) {
      console.error(`  ✗ ${relPath}: ${error.message}`);
      continue;
    }
    attachments.push({
      name: relPath,
      path: storagePath,
      mime: contentType,
      size: buffer.length,
    });
    console.log(`  ✓ ${relPath} (${buffer.length}B · ${contentType})`);
  }
  attachmentsBySet[cfg.setTitle] = attachments;
}

// 3. question_sets.attachments 갱신
console.log(`\n[3] Updating question_sets.attachments...`);
for (const [setTitle, attachments] of Object.entries(attachmentsBySet)) {
  const { data, error: findErr } = await supabase
    .from("question_sets")
    .select("id")
    .eq("title", setTitle)
    .single();
  if (findErr || !data) {
    console.error(`  ✗ Set "${setTitle}" not found: ${findErr?.message}`);
    continue;
  }
  const { error: updateErr } = await supabase
    .from("question_sets")
    .update({ attachments })
    .eq("id", data.id);
  if (updateErr) {
    console.error(`  ✗ Update failed for "${setTitle}": ${updateErr.message}`);
    continue;
  }
  console.log(`  ✓ "${setTitle}" attachments: ${attachments.length} files`);
}

console.log(`\n✅ 완료`);
