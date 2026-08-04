import { AdminShell, PageHeader, StatBox } from "@/components/admin-shell";
import { createAdminSupabase } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { AccountsTable, type AccountRow } from "./accounts-table";
import { CreateAccountForm } from "./create-form";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await getUser();
  const supabase = createAdminSupabase();

  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
  const users = list?.users ?? [];
  const userIds = users.map((u) => u.id);

  const { data: roles } = userIds.length
    ? await supabase.from("user_roles").select("user_id, role").in("user_id", userIds)
    : { data: [] };
  const { data: profiles } = userIds.length
    ? await supabase
        .from("profiles")
        .select("id, name, position, organization")
        .in("id", userIds)
    : { data: [] };

  const rolesByUser: Record<string, string[]> = {};
  for (const r of (roles ?? []) as { user_id: string; role: string }[]) {
    (rolesByUser[r.user_id] ??= []).push(r.role);
  }
  const profileByUser: Record<
    string,
    { name: string | null; position: string | null; organization: string | null }
  > = {};
  for (const p of (profiles ?? []) as {
    id: string;
    name: string | null;
    position: string | null;
    organization: string | null;
  }[]) {
    profileByUser[p.id] = {
      name: p.name,
      position: p.position,
      organization: p.organization,
    };
  }

  const rows: AccountRow[] = users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "-",
      name: profileByUser[u.id]?.name ?? null,
      position: profileByUser[u.id]?.position ?? null,
      organization: profileByUser[u.id]?.organization ?? null,
      roles: rolesByUser[u.id] ?? [],
      createdAt: u.created_at,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const roleCount = (role: string) => rows.filter((r) => r.roles.includes(role)).length;

  return (
    <AdminShell active="accounts" userEmail={user?.email}>
      <PageHeader
        title="계정 관리"
        description="스태프 계정을 생성하고 이름 · 직책 · 소속을 관리합니다. 로그인 인사말에 사용됩니다."
        action={<CreateAccountForm />}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBox label="전체 계정" value={rows.length} unit="개" />
        <StatBox label="관리자" value={roleCount("admin")} unit="명" tone="info" />
        <StatBox label="감독관" value={roleCount("examiner")} unit="명" tone="success" />
        <StatBox label="채점자" value={roleCount("grader")} unit="명" tone="warning" />
      </div>

      <AccountsTable rows={rows} />
    </AdminShell>
  );
}
