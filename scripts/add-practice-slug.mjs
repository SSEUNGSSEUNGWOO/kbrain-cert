/**
 * 마이그레이션 원격 반영 + 기존 시험에 practice_slug 발급
 * 실행: node --env-file=.env.local scripts/add-practice-slug.mjs
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("[1] Migration은 SQL Editor에서 수동 실행 완료 (승우님)");

// slug 발급 시도 (컬럼이 이미 존재해야 성공)
console.log("\n[2] Assigning practice_slug to existing exams...");
const { data: exams, error: fetchErr } = await supabase
  .from("exams")
  .select("id, title, practice_slug");
if (fetchErr) {
  console.error(`  ✗ ${fetchErr.message}`);
  console.error(
    "     → 컬럼이 아직 없음. 대시보드 SQL Editor에서 위 마이그레이션 실행 후 재시도"
  );
  process.exit(1);
}

for (const exam of exams ?? []) {
  if (exam.practice_slug) {
    console.log(`  · ${exam.title}: 이미 slug 있음 (${exam.practice_slug})`);
    continue;
  }
  const slug = crypto.randomBytes(6).toString("hex"); // 12자리 hex
  const { error } = await supabase
    .from("exams")
    .update({ practice_slug: slug })
    .eq("id", exam.id);
  if (error) {
    console.error(`  ✗ ${exam.title}: ${error.message}`);
    continue;
  }
  console.log(`  ✓ ${exam.title}`);
  console.log(`     테스트 링크: /practice/${slug}`);
}

console.log("\n✅ 완료");
