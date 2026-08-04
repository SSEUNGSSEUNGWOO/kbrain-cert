import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

const STAFF_ROLES = ["admin", "examiner", "grader"] as const;
type StaffRole = (typeof STAFF_ROLES)[number];

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };

  const admin = createAdminSupabase();
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };

  return { admin };
}

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await request.json().catch(() => null);
  const { email, password, role, name, position, organization } = (body ?? {}) as {
    email?: string;
    password?: string;
    role?: string;
    name?: string;
    position?: string;
    organization?: string;
  };

  const cleanEmail = email?.trim();
  if (!cleanEmail || !password || password.length < 6) {
    return NextResponse.json(
      { error: "이메일과 6자 이상 비밀번호가 필요합니다" },
      { status: 400 }
    );
  }
  if (!STAFF_ROLES.includes(role as StaffRole)) {
    return NextResponse.json({ error: "역할이 올바르지 않습니다" }, { status: 400 });
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
  });
  if (createErr) {
    const status = /already/i.test(createErr.message) ? 409 : 500;
    return NextResponse.json(
      { error: status === 409 ? "이미 등록된 이메일입니다" : createErr.message },
      { status }
    );
  }
  const userId = created.user.id;

  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
  if (roleErr) {
    return NextResponse.json({ error: roleErr.message }, { status: 500 });
  }

  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    email: cleanEmail,
    name: name?.trim() || null,
    position: position?.trim() || null,
    organization: organization?.trim() || null,
  });
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId });
}

export async function PATCH(request: Request) {
  const guard = await requireAdmin();
  if ("error" in guard) return guard.error;
  const { admin } = guard;

  const body = await request.json().catch(() => null);
  const { userId, name, position, organization } = (body ?? {}) as {
    userId?: string;
    name?: string;
    position?: string;
    organization?: string;
  };
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const { data: target, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !target.user) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다" }, { status: 404 });
  }

  const { error: profErr } = await admin.from("profiles").upsert({
    id: userId,
    email: target.user.email ?? null,
    name: name?.trim() || null,
    position: position?.trim() || null,
    organization: organization?.trim() || null,
  });
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
