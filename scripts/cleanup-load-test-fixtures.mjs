/**
 * 부하 테스트 후 정리
 * - LoadTest001~100 이름의 exam_invitations 삭제
 * - 관련 exam_sessions, answers 도 ON DELETE CASCADE 로 자동 정리
 *
 * 실행:
 *   node --env-file=.env.local scripts/cleanup-load-test-fixtures.mjs <EXAM_ID>
 */
import { createClient } from "@supabase/supabase-js";

const examId = process.argv[2];
if (!examId) {
  console.error("Usage: node --env-file=.env.local scripts/cleanup-load-test-fixtures.mjs <EXAM_ID>");
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

// 관련 세션도 미리 카운트 (참고용)
const { data: invitations } = await supabase
  .from("exam_invitations")
  .select("id")
  .eq("exam_id", examId)
  .like("name", "LoadTest%");
const invitationIds = (invitations ?? []).map((i) => i.id);
if (invitationIds.length === 0) {
  console.log("정리할 fixture 없음.");
  process.exit(0);
}

const { count: sessionCount } = await supabase
  .from("exam_sessions")
  .select("id", { count: "exact", head: true })
  .in("invitation_id", invitationIds);

console.log(`Deleting ${invitationIds.length} invitations · ${sessionCount ?? 0} 관련 세션 (cascade 삭제)`);

const { error } = await supabase
  .from("exam_invitations")
  .delete()
  .eq("exam_id", examId)
  .like("name", "LoadTest%");
if (error) {
  console.error("delete error:", error.message);
  process.exit(1);
}

console.log("✓ 정리 완료");
