import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

/**
 * 응시자 신분증 이미지 업로드
 * FormData: file (image/*)
 * - 세션 쿠키 인증
 * - 이전 이미지가 있으면 삭제 후 새로 업로드 (재업로드 지원)
 * - exam_sessions.identity_image_url 갱신, identity_review_status='pending'
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
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_SIZE / 1024 / 1024}MB)` },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { error: "이미지만 업로드 가능합니다 (JPG · PNG · WebP · HEIC)" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabase();
  const { data: session } = await admin
    .from("exam_sessions")
    .select("id, submit_time, identity_image_url")
    .eq("id", cookieSessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.submit_time) {
    return NextResponse.json({ error: "already submitted" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash("md5").update(buffer).digest("hex").slice(0, 12);
  const ext = getExt(file.name) || getExtFromMime(file.type);
  const storagePath = `${cookieSessionId}/identity_${hash}${ext}`;

  // 이전 이미지 삭제
  if (session.identity_image_url && session.identity_image_url !== storagePath) {
    await admin.storage
      .from("identity-documents")
      .remove([session.identity_image_url]);
  }

  const { error: uploadErr } = await admin.storage
    .from("identity-documents")
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  await admin
    .from("exam_sessions")
    .update({
      identity_image_url: storagePath,
      identity_review_status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", cookieSessionId);

  return NextResponse.json({
    ok: true,
    path: storagePath,
    name: file.name,
    size: file.size,
  });
}

function getExt(name: string): string {
  const m = name.match(/(\.[a-zA-Z0-9]{1,10})$/);
  return m ? m[1].toLowerCase() : "";
}
function getExtFromMime(mime: string): string {
  if (mime.includes("jpeg")) return ".jpg";
  if (mime.includes("png")) return ".png";
  if (mime.includes("webp")) return ".webp";
  if (mime.includes("heic")) return ".heic";
  if (mime.includes("heif")) return ".heif";
  return "";
}
