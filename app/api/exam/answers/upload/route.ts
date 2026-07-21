import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { createAdminSupabase } from "@/lib/supabase/server";
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieValue,
} from "@/lib/exam/session-cookie";
import { getSessionDeadlineMs } from "@/lib/exam/deadline";

const MAX_FILE_SIZE = 20 * 1024 * 1024;

type UploadBody = {
  sessionId?: string;
  questionId?: string;
  slotId?: string;
  fileName?: string;
  fileSize?: number;
  mime?: string;
  path?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as UploadBody | null;
  const validated = await validateUploadRequest(request, body);
  if (validated instanceof NextResponse) return validated;

  const ext = getExt(body!.fileName!);
  const storagePath =
    `${validated.sessionId}/${validated.questionId}/${validated.slotId}/` +
    `${randomBytes(16).toString("hex")}${ext}`;
  const { data, error } = await validated.admin.storage
    .from("answer-files")
    .createSignedUploadUrl(storagePath);
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "upload token failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    path: storagePath,
    token: data.token,
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as UploadBody | null;
  const validated = await validateUploadRequest(request, body);
  if (validated instanceof NextResponse) return validated;
  if (!body?.path || !isOwnedPath(body.path, validated)) {
    return NextResponse.json({ error: "invalid upload path" }, { status: 400 });
  }

  const stateError = await validateSessionState(
    validated.admin,
    validated.sessionId
  );
  if (stateError) {
    await validated.admin.storage.from("answer-files").remove([body.path]);
    return stateError;
  }

  return NextResponse.json({
    file: {
      path: body.path,
      name: body.fileName,
      size: body.fileSize,
      mime: body.mime || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
    },
  });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as UploadBody | null;
  const validated = await validateUploadRequest(request, body);
  if (validated instanceof NextResponse) return validated;
  if (!body?.path || !isOwnedPath(body.path, validated)) {
    return NextResponse.json({ error: "invalid upload path" }, { status: 400 });
  }
  const { error } = await validated.admin.storage
    .from("answer-files")
    .remove([body.path]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

async function validateUploadRequest(request: Request, body: UploadBody | null) {
  const cookieStore = await cookies();
  const cookieSessionId = verifySessionCookieValue(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );
  if (!cookieSessionId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sessionId = body?.sessionId ?? "";
  const questionId = body?.questionId ?? "";
  const slotId = body?.slotId ?? "";
  if (
    !sessionId ||
    !questionId ||
    !slotId ||
    !body?.fileName ||
    !Number.isFinite(body.fileSize) ||
    body.fileSize! < 0 ||
    body.fileSize! > MAX_FILE_SIZE
  ) {
    return NextResponse.json({ error: "invalid upload request" }, { status: 400 });
  }
  if (cookieSessionId !== sessionId) {
    return NextResponse.json({ error: "session mismatch" }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const stateError = await validateSessionState(admin, sessionId);
  if (stateError) return stateError;

  const { data: session } = await admin
    .from("exam_sessions")
    .select("exam_id")
    .eq("id", sessionId)
    .single();
  const { data: examQuestion } = await admin
    .from("exam_questions")
    .select("questions(submission_slots)")
    .eq("exam_id", session!.exam_id)
    .eq("question_id", questionId)
    .maybeSingle();
  const slots = (
    examQuestion as unknown as {
      questions: {
        submission_slots: Array<{
          id?: string;
          type?: string;
          accept?: string;
        }>;
      } | null;
    } | null
  )?.questions?.submission_slots;
  const slot = Array.isArray(slots)
    ? slots.find((candidate) => candidate.id === slotId && candidate.type === "file")
    : undefined;
  if (!slot) {
    return NextResponse.json(
      { error: "file slot not in exam question" },
      { status: 400 }
    );
  }
  if (!matchesAcceptedFile(body.fileName, body.mime, slot.accept)) {
    return NextResponse.json(
      { error: `허용되지 않는 파일 형식입니다. 허용: ${slot.accept}` },
      { status: 400 }
    );
  }
  return { admin, sessionId, questionId, slotId };
}

function matchesAcceptedFile(
  fileName: string,
  mime: string | undefined,
  accept: string | undefined
): boolean {
  if (!accept?.trim()) return true;
  const lowerName = fileName.toLowerCase();
  const lowerMime = (mime ?? "").toLowerCase();
  return accept.split(",").some((rawToken) => {
    const token = rawToken.trim().toLowerCase();
    if (token.startsWith(".")) return lowerName.endsWith(token);
    if (token.endsWith("/*")) return lowerMime.startsWith(token.slice(0, -1));
    return token === lowerMime;
  });
}

async function validateSessionState(
  admin: ReturnType<typeof createAdminSupabase>,
  sessionId: string
) {
  const { data: session } = await admin
    .from("exam_sessions")
    .select(
      "exam_id, start_time, submit_time, status, time_extension_minutes"
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.submit_time || session.status === "submitted") {
    return NextResponse.json({ error: "already submitted" }, { status: 409 });
  }
  const { data: exam } = await admin
    .from("exams")
    .select("exam_date, duration_minutes")
    .eq("id", session.exam_id)
    .single();
  const deadlineMs = exam
    ? getSessionDeadlineMs({
        examDate: exam.exam_date,
        startTime: session.start_time,
        durationMinutes: exam.duration_minutes,
        extensionMinutes: session.time_extension_minutes ?? 0,
      })
    : null;
  if (!exam || (deadlineMs != null && deadlineMs <= Date.now())) {
    return NextResponse.json({ error: "exam time expired" }, { status: 409 });
  }
  return null;
}

function isOwnedPath(
  path: string,
  owner: { sessionId: string; questionId: string; slotId: string }
) {
  return path.startsWith(
    `${owner.sessionId}/${owner.questionId}/${owner.slotId}/`
  );
}

function getExt(name: string): string {
  const match = name.match(/(\.[a-zA-Z0-9]{1,10})$/);
  return match ? match[1].toLowerCase() : "";
}
