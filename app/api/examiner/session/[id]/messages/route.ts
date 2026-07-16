import { NextResponse } from "next/server";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";

/**
 * 감독관 → 응시자 메시지 전송
 * Body: { content: string, isAnnouncement?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "examiner"])
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: sessionId } = await params;
  const body = await request.json().catch(() => null);
  const { content, isAnnouncement } = (body ?? {}) as {
    content?: string;
    isAnnouncement?: boolean;
  };
  const trimmed = (content ?? "").trim();
  if (!trimmed || trimmed.length > 500) {
    return NextResponse.json(
      { error: "content required (1..500)" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  const { error } = await admin.from("session_messages").insert({
    session_id: sessionId,
    sender_role: "examiner",
    sender_id: user.id,
    content: trimmed,
    is_announcement: !!isAnnouncement,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * 감독관용 메시지 조회 (실시간 폴백)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "examiner"])
    .maybeSingle();
  if (!role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id: sessionId } = await params;
  const admin = createAdminSupabase();
  const { data: messages } = await admin
    .from("session_messages")
    .select("id, session_id, sender_role, content, is_announcement, created_at, read_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  return NextResponse.json({ messages: messages ?? [] });
}
