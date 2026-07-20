import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

type Row = {
  name?: string;
  phone?: string;
  email?: string;
  organization?: string;
};

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminSupabase();
  const { data: role } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const { examId, rows } = (body ?? {}) as { examId?: string; rows?: Row[] };
  if (!examId || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "examId and rows required" }, { status: 400 });
  }
  if (rows.length > 1000) {
    return NextResponse.json({ error: "max 1000 rows" }, { status: 400 });
  }

  const { data: exam } = await admin
    .from("exams")
    .select("id, slug")
    .eq("id", examId)
    .maybeSingle();
  if (!exam) return NextResponse.json({ error: "exam not found" }, { status: 404 });

  const inserts = rows.map((row) => ({
    exam_id: examId,
    name: row.name?.trim() ?? "",
    phone: row.phone?.trim() ?? "",
    email: row.email?.trim() || null,
    organization: row.organization?.trim() || null,
    invite_code: randomBytes(6).toString("hex"),
    status: "created" as const,
  }));
  if (inserts.some((row) => !row.name || row.phone.replace(/\D/g, "").length < 4)) {
    return NextResponse.json({ error: "every row requires name and valid phone" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("exam_invitations")
    .insert(inserts)
    .select("name, phone");
  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.code === "23505" ? 409 : 500 }
    );
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const entryUrl = `${base.replace(/\/$/, "")}/exam/${exam.slug ?? exam.id}`;
  return NextResponse.json({
    created: (data ?? []).map((row) => ({
      name: row.name,
      phone: row.phone,
      entryUrl,
    })),
    errors: [],
  });
}
