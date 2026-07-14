import { requireRole } from "@/lib/auth";

/**
 * /admin/* 서브트리 auth guard
 * admin role 없으면 requireRole이 리다이렉트
 * 각 페이지는 여전히 AdminShell을 자기 컨텐츠로 감쌈 (active 지정 목적)
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin");
  return <>{children}</>;
}
