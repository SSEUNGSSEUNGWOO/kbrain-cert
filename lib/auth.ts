import { redirect } from "next/navigation";
import { createServerSupabase, createAdminSupabase } from "@/lib/supabase/server";

export type AppRole = "admin" | "examiner" | "grader" | "applicant";

/**
 * 현재 로그인한 사용자 조회 (없으면 null)
 * Server Component · Server Action에서 사용
 */
export async function getUser() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/**
 * 현재 사용자의 role 목록 조회
 * user_roles 테이블은 SELECT 정책이 미설정이라 admin client로 조회
 */
export async function getUserRoles(userId: string): Promise<AppRole[]> {
  const admin = createAdminSupabase();
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error || !data) return [];
  return data.map((r) => r.role as AppRole);
}

/**
 * 페이지 가드 · 로그인 안 됐으면 /login으로 리다이렉트
 */
export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * 페이지 가드 · 특정 role 있어야 통과 · 단일값 or 배열(OR 매칭)
 * 없으면 홈으로 리다이렉트 (권한 없음)
 */
export async function requireRole(role: AppRole | AppRole[]) {
  const user = await requireAuth();
  const roles = await getUserRoles(user.id);
  const required = Array.isArray(role) ? role : [role];
  if (!required.some((r) => roles.includes(r))) {
    redirect("/?forbidden=" + required.join(","));
  }
  return { user, roles };
}
