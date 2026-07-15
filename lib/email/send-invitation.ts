/**
 * 이메일 발송 · Resend 미등록 상태에서는 콘솔 출력만 (stub)
 * Resend 등록 후 아래 TODO 부분을 아래로 교체:
 *   import { Resend } from "resend";
 *   const resend = new Resend(process.env.RESEND_API_KEY!);
 *   await resend.emails.send({ from: FROM, to, subject, html });
 */

const FROM = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

export async function sendInvitationEmail(params: {
  to: string;
  name: string | null;
  examTitle: string;
  entryUrl: string;
  scheduledAt?: Date | null;
}) {
  const subject = `[kbrain-cert] ${params.examTitle} 시험 초대`;
  const scheduledText = params.scheduledAt
    ? `\n\n📅 응시 일시: ${formatDateKo(params.scheduledAt)}`
    : "";
  const body = `안녕하세요${params.name ? ` ${params.name}님` : ""},

케이브레인 자격시험 ${params.examTitle}에 초대되셨습니다.

아래 링크로 접속하여 응시하실 수 있습니다:
${params.entryUrl}
${scheduledText}

문의: no-reply@kbrainc.com
- kbrain-cert`;

  // TODO(Resend): const { data, error } = await resend.emails.send({ from: FROM, to, subject, text: body });
  console.log("\n[email:invitation]", "→", params.to);
  console.log("from:", FROM);
  console.log("subject:", subject);
  console.log(body);
  return { ok: true, stub: true };
}

export async function sendOtpEmail(params: {
  to: string;
  code: string;
  expiresInMinutes: number;
}) {
  const subject = `[kbrain-cert] 응시 인증 코드`;
  const body = `응시 인증 코드입니다:

    ${params.code}

이 코드는 ${params.expiresInMinutes}분간 유효합니다.
코드를 요청하지 않으셨다면 이 메일을 무시하세요.

- kbrain-cert`;

  // TODO(Resend): await resend.emails.send({ from: FROM, to, subject, text: body });
  console.log("\n[email:otp]", "→", params.to, "code:", params.code);
  console.log("from:", FROM);
  console.log("subject:", subject);
  console.log(body);
  return { ok: true, stub: true };
}

function formatDateKo(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
