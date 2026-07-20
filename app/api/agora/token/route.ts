import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { RtcRole, RtcTokenBuilder } from "agora-token";
import { createAdminSupabase, createServerSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

const TOKEN_TTL_SECONDS = 60 * 60 * 6;

export async function POST(request: Request) {
  const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
  const certificate = process.env.AGORA_APP_CERTIFICATE;
  if (!appId || !certificate) {
    return NextResponse.json({ error: "Agora is not configured" }, { status: 503 });
  }

  const admin = createAdminSupabase();
  const body = (await request.json().catch(() => null)) as {
    mode?: "applicant" | "examiner";
    media?: "webcam" | "screen";
    uid?: string;
    examId?: string;
  } | null;
  const cookieStore = await cookies();
  const sessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );

  let examId: string;
  let uid: string;
  let clientRole: "host" | "audience";

  if (body?.mode === "applicant" && sessionId) {
    const { data: session } = await admin
      .from("exam_sessions")
      .select("id, exam_id, submit_time")
      .eq("id", sessionId)
      .maybeSingle();
    if (!session || session.submit_time) {
      return NextResponse.json({ error: "invalid session" }, { status: 403 });
    }
    examId = session.exam_id;
    const uidPrefix =
      body.media === "screen"
        ? `screen-${session.id}-`
        : `applicant-${session.id}-`;
    uid =
      typeof body.uid === "string" &&
      body.uid.startsWith(uidPrefix) &&
      /^[a-f0-9]{12}$/.test(body.uid.slice(uidPrefix.length))
        ? body.uid
        : `${uidPrefix}${randomBytes(6).toString("hex")}`;
    clientRole = "host";
  } else {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "examiner"])
      .limit(1)
      .maybeSingle();
    if (!role) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    examId = body?.examId ?? "";
    if (!examId) {
      return NextResponse.json({ error: "examId required" }, { status: 400 });
    }
    uid = `examiner-${user.id}`;
    clientRole = "audience";
  }

  const channel = `exam-${examId}`;
  const token = RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    certificate,
    channel,
    uid,
    RtcRole.PUBLISHER,
    TOKEN_TTL_SECONDS,
    TOKEN_TTL_SECONDS
  );

  return NextResponse.json({ appId, channel, uid, token, clientRole });
}
