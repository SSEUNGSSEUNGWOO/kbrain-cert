/**
 * 첫 admin 계정 부트스트랩
 * 실행: node --env-file=.env.local scripts/bootstrap-admin.mjs <UUID>
 */
import { createClient } from "@supabase/supabase-js";

const uuid = process.argv[2];
const email = process.argv[3] ?? "sseung@kbrainc.com";
const name = process.argv[4] ?? "장승우";
const organization = process.argv[5] ?? "kbrainc";

if (!uuid) {
  console.error("Usage: node --env-file=.env.local scripts/bootstrap-admin.mjs <UUID> [email] [name] [org]");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log(`Bootstrapping admin: ${email} (${uuid})`);

// 1) admin role 부여 (unique user_id+role 이므로 upsert)
const { error: e1 } = await supabase
  .from("user_roles")
  .upsert({ user_id: uuid, role: "admin" }, { onConflict: "user_id,role" });
if (e1) {
  console.error("user_roles error:", e1.message);
  process.exit(1);
}
console.log("✓ user_roles: admin 부여 완료");

// 2) profile 생성/갱신
const { error: e2 } = await supabase.from("profiles").upsert({
  id: uuid,
  email,
  name,
  organization,
});
if (e2) {
  console.error("profiles error:", e2.message);
  process.exit(1);
}
console.log("✓ profiles: 프로필 저장 완료");

// 3) 확인
const { data: check } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", uuid);
console.log("현재 role:", check?.map((r) => r.role).join(", "));

console.log("\n완료 · http://localhost:3000/login 에서 로그인하세요");
