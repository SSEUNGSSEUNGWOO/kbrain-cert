import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "kbrain_exam_session";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 6; // 6h · 시험 최대 시간 + 여유

export function getExamSessionSecret(): string {
  const secret = process.env.EXAM_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("EXAM_SESSION_SECRET is required");
    }
    return "dev-fallback-secret-not-for-production";
  }
  return secret;
}

function sign(sessionId: string): string {
  return createHmac("sha256", getExamSessionSecret())
    .update(sessionId)
    .digest("base64url");
}

/**
 * 응시자 세션 쿠키 값 생성 · `<sessionId>.<hmac>`
 * 명단의 이름·전화번호 뒷 4자리 검증 성공 시 발급
 */
export function makeSessionCookieValue(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

/**
 * 쿠키에서 sessionId 추출 · 서명 검증 실패 시 null
 */
export function verifySessionCookieValue(value: string | undefined): string | null {
  if (!value) return null;
  const [sessionId, sig] = value.split(".");
  if (!sessionId || !sig) return null;
  const expected = sign(sessionId);
  const actualBuffer = Buffer.from(sig);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }
  return sessionId;
}

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export { COOKIE_NAME as SESSION_COOKIE_NAME, COOKIE_MAX_AGE_SECONDS };
