/**
 * 기존 개별 파일 삭제 + 원본 zip 3개 업로드
 * 실행: node --env-file=.env.local scripts/replace-attachments-with-zip.mjs
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

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
const BASE_DIR = "C:/Users/USER/Downloads/1세트_정책모니터링";

const setsConfig = [
  {
    setTitle: "1과목 · 콘텐츠",
    folder: "1과목_콘텐츠",
    zip: "1과목_자료묶음.zip",
    prefix: "exam-blue-1/set-1",
    storageZipKey: "exam-blue-1/set-1/materials.zip",
    fileCount: 8, // 안내용 (zip 안의 파일 개수)
  },
  {
    setTitle: "2과목 · 데이터분석",
    folder: "2과목_데이터분석",
    zip: "2과목_자료묶음.zip",
    prefix: "exam-blue-1/set-2",
    storageZipKey: "exam-blue-1/set-2/materials.zip",
    fileCount: 2,
  },
  {
    setTitle: "3과목 · 자동화",
    folder: "3과목_자동화",
    zip: "3과목_자료묶음.zip",
    prefix: "exam-blue-1/set-3",
    storageZipKey: "exam-blue-1/set-3/materials.zip",
    fileCount: 10,
  },
];

// 1. 기존 개별 파일 삭제 (각 prefix 하위)
console.log("[1] Deleting existing individual files...");
for (const cfg of setsConfig) {
  const { data: list, error: listErr } = await supabase.storage
    .from(BUCKET)
    .list(cfg.prefix, { limit: 100 });
  if (listErr) {
    console.error(`  ✗ list ${cfg.prefix}: ${listErr.message}`);
    continue;
  }
  const toDelete = (list ?? [])
    .map((f) => `${cfg.prefix}/${f.name}`)
    // 만일 materials.zip이 이미 있으면 그것도 삭제 (재실행 대비)
    ;
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.storage
      .from(BUCKET)
      .remove(toDelete);
    if (delErr) {
      console.error(`  ✗ delete ${cfg.prefix}: ${delErr.message}`);
    } else {
      console.log(`  ✓ ${cfg.prefix}: ${toDelete.length} files deleted`);
    }
  }
}

// 2. 원본 zip 업로드
console.log("\n[2] Uploading original zips...");
for (const cfg of setsConfig) {
  const zipPath = path.join(BASE_DIR, cfg.folder, "첨부", cfg.zip);
  if (!fs.existsSync(zipPath)) {
    console.error(`  ✗ Not found: ${zipPath}`);
    continue;
  }
  const buffer = fs.readFileSync(zipPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(cfg.storageZipKey, buffer, {
      contentType: "application/zip",
      upsert: true,
    });
  if (error) {
    console.error(`  ✗ ${cfg.zip}: ${error.message}`);
    continue;
  }
  console.log(`  ✓ ${cfg.zip} → ${cfg.storageZipKey} (${buffer.length}B)`);
}

// 3. question_sets.attachments 단순화 (zip 하나만)
console.log("\n[3] Updating question_sets.attachments...");
for (const cfg of setsConfig) {
  const zipPath = path.join(BASE_DIR, cfg.folder, "첨부", cfg.zip);
  const size = fs.statSync(zipPath).size;
  const attachments = [
    {
      name: cfg.zip, // 원본 이름 (다운로드 파일명)
      path: cfg.storageZipKey,
      mime: "application/zip",
      size,
      entries: cfg.fileCount, // 안의 파일 개수 (안내용)
    },
  ];
  const { data: setRow, error: findErr } = await supabase
    .from("question_sets")
    .select("id")
    .eq("title", cfg.setTitle)
    .single();
  if (findErr) {
    console.error(`  ✗ find ${cfg.setTitle}: ${findErr.message}`);
    continue;
  }
  const { error: updateErr } = await supabase
    .from("question_sets")
    .update({ attachments })
    .eq("id", setRow.id);
  if (updateErr) {
    console.error(`  ✗ update ${cfg.setTitle}: ${updateErr.message}`);
    continue;
  }
  console.log(`  ✓ ${cfg.setTitle}: 1 zip (${cfg.fileCount} entries · ${size}B)`);
}

console.log("\n✅ 완료");
