import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 응시자 답안 파일 업로드
 * FormData: sessionId · questionId · slotId · file
 * 응답: { file: { path, name, size, mime, uploadedAt } }
 * slot_values 업데이트는 클라이언트가 별도로 /answers/save 호출
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (!cookieSessionId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "invalid form" }, { status: 400 });
  }
  const sessionId = String(form.get("sessionId") ?? "");
  const questionId = String(form.get("questionId") ?? "");
  const slotId = String(form.get("slotId") ?? "");
  const file = form.get("file");

  if (!sessionId || !questionId || !slotId || !(file instanceof File)) {
    return NextResponse.json(
      { error: "sessionId, questionId, slotId, file required" },
      { status: 400 }
    );
  }
  if (cookieSessionId !== sessionId) {
    return NextResponse.json({ error: "session mismatch" }, { status: 403 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id, submit_time, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.submit_time || session.status === "submitted") {
    return NextResponse.json({ error: "already submitted" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = getExt(file.name);
  const hash = createHash("md5").update(buffer).digest("hex").slice(0, 12);
  const salt = randomBytes(4).toString("hex");
  const storagePath = `${sessionId}/${questionId}/${slotId}/${hash}${salt}${ext}`;

  const { error } = await admin.storage
    .from("answer-files")
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    file: {
      path: storagePath,
      name: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
    },
  });
}

function getExt(name: string): string {
  const m = name.match(/(\.[a-zA-Z0-9]{1,10})$/);
  return m ? m[1].toLowerCase() : "";
}
