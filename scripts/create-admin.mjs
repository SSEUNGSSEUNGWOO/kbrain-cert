/**
 * 신규 admin 계정 생성 (Auth 유저 + role + profile)
 * 실행: node --env-file=.env.local scripts/create-admin.mjs <email> <password> [name] [org]
 */
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
const password = process.argv[3];
const name = process.argv[4] ?? email?.split("@")[0] ?? "admin";
const organization = process.argv[5] ?? "kbrainc";

if (!email || !password) {
  console.error(
    "Usage: node --env-file=.env.local scripts/create-admin.mjs <email> <password> [name] [org]"
  );
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

console.log(`Creating admin: ${email}  @ ${url}`);

// 1) Auth 유저 생성 (이미 있으면 재사용)
let userId = null;
const { data: created, error: createErr } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
if (createErr) {
  if (/already/i.test(createErr.message)) {
    const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      console.error("listUsers error:", listErr.message);
      process.exit(1);
    }
    const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) {
      console.error("Auth 유저가 있다는데 목록에서 찾지 못했습니다.");
      process.exit(1);
    }
    userId = existing.id;
    console.log(`↺ Auth 유저 이미 존재: ${userId}`);
    const { error: updErr } = await supabase.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updErr) {
      console.error("비밀번호 갱신 실패:", updErr.message);
      process.exit(1);
    }
    console.log("✓ 비밀번호 갱신");
  } else {
    console.error("createUser error:", createErr.message);
    process.exit(1);
  }
} else {
  userId = created.user.id;
  console.log(`✓ Auth 유저 생성: ${userId}`);
}

// 2) admin role 부여
const { error: roleErr } = await supabase
  .from("user_roles")
  .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
if (roleErr) {
  console.error("user_roles error:", roleErr.message);
  process.exit(1);
}
console.log("✓ user_roles: admin 부여");

// 3) profile 저장
const { error: profErr } = await supabase.from("profiles").upsert({
  id: userId,
  email,
  name,
  organization,
});
if (profErr) {
  console.error("profiles error:", profErr.message);
  process.exit(1);
}
console.log("✓ profiles 저장");

const { data: check } = await supabase
  .from("user_roles")
  .select("role")
  .eq("user_id", userId);
console.log("현재 role:", check?.map((r) => r.role).join(", "));

console.log("\n완료 · /login 에서 로그인하세요");
