/**
 * 부하 테스트용 fixture seeding
 * - 대상 exam에 LoadTest001~100 이름 + 010-0000-0001~0100 phone 의 exam_invitations 100개 생성
 * - is_test_mode 시험을 대상으로 하는 것을 권장 (재응시 자유)
 *
 * 실행:
 *   node --env-file=.env.local scripts/seed-load-test-fixtures.mjs <EXAM_ID>
 */
import { createClient } from "@supabase/supabase-js";

const examId = process.argv[2];
if (!examId) {
  console.error("Usage: node --env-file=.env.local scripts/seed-load-test-fixtures.mjs <EXAM_ID>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: exam, error: examErr } = await supabase
  .from("exams")
  .select("id, title, is_test_mode, status")
  .eq("id", examId)
  .single();
if (examErr || !exam) {
  console.error("exam not found:", examErr?.message ?? examId);
  process.exit(1);
}

console.log(`Target exam: ${exam.title} (${exam.id})`);
console.log(`  is_test_mode: ${exam.is_test_mode}`);
console.log(`  status:       ${exam.status}`);

if (!exam.is_test_mode && exam.status !== "open") {
  console.warn("⚠  is_test_mode=false & status<>open → applicants can't enter.");
  console.warn("   test 시험이거나 status=open 이어야 합니다.");
}

// LoadTest001..LoadTest100, 010-0000-0001..0100
const rows = Array.from({ length: 100 }, (_, i) => {
  const idx = String(i + 1).padStart(3, "0");
  const phone4 = String(i + 1).padStart(4, "0");
  return {
    exam_id: examId,
    name: `LoadTest${idx}`,
    phone: `010-0000-${phone4}`,
    email: `loadtest${idx}@example.invalid`,
    invite_code: `LT-${examId.slice(0, 8)}-${idx}`,
    status: "created",
  };
});

console.log(`\nUpserting 100 exam_invitations...`);

// 이미 있는지 조회
const { data: existing } = await supabase
  .from("exam_invitations")
  .select("name")
  .eq("exam_id", examId)
  .like("name", "LoadTest%");
const existingNames = new Set((existing ?? []).map((e) => e.name));

const toInsert = rows.filter((r) => !existingNames.has(r.name));
if (toInsert.length === 0) {
  console.log("✓ 이미 100개 존재 · 새로 삽입할 것 없음");
} else {
  const { error: insertErr } = await supabase
    .from("exam_invitations")
    .insert(toInsert);
  if (insertErr) {
    console.error("insert error:", insertErr.message);
    process.exit(1);
  }
  console.log(`✓ ${toInsert.length}개 신규 삽입 (기존 ${existingNames.size}개 유지)`);
}

// 부하 테스트에 쓸 questions 목록도 함께 안내
const { data: questions } = await supabase
  .from("exam_questions")
  .select("question_id, questions(id, set_id)")
  .eq("exam_id", examId)
  .limit(3);
const questionIds = (questions ?? [])
  .map((q) => q.question_id)
  .filter(Boolean);

console.log("\n===================================================");
console.log("다음 명령으로 k6 실행 (Vercel Preview URL 사용 권장):");
console.log("");
console.log(`  $env:BASE_URL="https://<preview-url>"`);
console.log(`  $env:EXAM_ID="${examId}"`);
if (questionIds.length > 0) {
  console.log(`  $env:QUESTION_IDS="${questionIds.join(",")}"`);
}
console.log(`  k6 run tests/load/exam-flow.js`);
console.log("===================================================");
