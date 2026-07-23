/**
 * 응시 안내 이메일 HTML 템플릿
 * - 관리자가 발송 전 미리보기 + 복사해서 Outlook/Gmail 등에 붙여넣기용
 * - Table 기반 · Inline CSS · Outlook/Naver/Gmail/Daum 호환
 * - {평가 대상} 은 응시자별 발송 시 관리자가 개별로 치환
 */

export type InvitationEmailData = {
  examTitle: string;
  examPeriod: string; // "2026.07.25 (금) 14:00" 등 자유 문자열
  durationMinutes: number;
  entryUrl: string; // 응시 진입 절대 URL · https://.../exam/{slug}
  contact?: string; // 담당자 및 연락처 · 없으면 플레이스홀더 유지
  format?: string; // 평가 방식 · 기본값 "CBT · 원격 감독"
};

export function renderInvitationEmail(data: InvitationEmailData): string {
  const contact = data.contact ?? "{담당자 및 연락처}";
  const format = data.format ?? "CBT · 원격 감독";
  const entryUrl = data.entryUrl;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.examTitle)} 안내</title>
</head>
<body style="margin:0;padding:24px;background:#EDEEF2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto;">
    <tr>
      <td style="background:#0B1B3D;padding:40px 40px 32px 40px;border-radius:8px 8px 0 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="color:#C9A45E;font-size:12px;font-weight:700;letter-spacing:3px;">DAEASY</td>
            <td style="text-align:right;color:#8A8DBF;font-size:12px;font-weight:700;letter-spacing:3px;">AI CHAMPION</td>
          </tr>
        </table>
        <div style="border-top:1px solid rgba(201,164,94,0.3);margin:16px 0 40px 0;line-height:0;font-size:0;">&nbsp;</div>

        <div style="text-align:center;">
          <div style="color:#C9A45E;font-size:11px;letter-spacing:4px;margin-bottom:12px;font-weight:600;">COMPETENCY ASSESSMENT</div>
          <div style="color:#ffffff;font-size:30px;font-weight:800;margin:0 0 20px 0;letter-spacing:-0.5px;line-height:1.3;">
            AI 챔피언 역량평가 안내
          </div>
          <p style="color:#A8B0C4;font-size:14px;line-height:1.7;margin:0 0 32px 0;">
            그동안 갈고닦은 AI 역량을 확인하는 시간입니다.<br>
            아래 정보를 확인하신 후 평가에 참여해 주세요.
          </p>
        </div>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#0A1730;border:1px solid rgba(201,164,94,0.3);border-radius:6px;margin-bottom:36px;">
          <tr>
            <td style="padding:24px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="color:#C9A45E;font-size:13px;padding:8px 0;width:100px;font-weight:600;">평가 기간</td>
                  <td style="color:#ffffff;font-size:13px;padding:8px 0;">${escapeHtml(data.examPeriod)}</td>
                </tr>
                <tr>
                  <td style="color:#C9A45E;font-size:13px;padding:8px 0;font-weight:600;">소요 시간</td>
                  <td style="color:#ffffff;font-size:13px;padding:8px 0;">${data.durationMinutes}분</td>
                </tr>
                <tr>
                  <td style="color:#C9A45E;font-size:13px;padding:8px 0;font-weight:600;">평가 방식</td>
                  <td style="color:#ffffff;font-size:13px;padding:8px 0;">${escapeHtml(format)}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="center">
              <a href="${escapeAttr(entryUrl)}" style="display:inline-block;background:#C9A45E;color:#0B1B3D;padding:16px 48px;text-decoration:none;font-size:15px;font-weight:700;border-radius:4px;letter-spacing:0.5px;">
                역량평가 바로가기 →
              </a>
            </td>
          </tr>
        </table>
        <p style="text-align:center;color:#7B85A0;font-size:11px;margin:12px 0 0 0;">
          이미지를 클릭해도 평가 페이지로 이동합니다.
        </p>
      </td>
    </tr>

    <tr>
      <td style="background:#ffffff;padding:28px 40px 24px 40px;border-radius:0 0 8px 8px;">
        <div style="color:#333;font-size:12px;line-height:2;">
          <div>- 안정적인 네트워크 환경에서 PC로 접속해 주세요.</div>
          <div>- 문의: ${escapeHtml(contact)}</div>
        </div>
        <div style="border-top:1px solid #E5E7EB;margin:20px 0 14px 0;line-height:0;font-size:0;">&nbsp;</div>
        <div style="color:#9CA3AF;font-size:11px;">
          ㈜케이브레인컴퍼니 - DAEASY | 본 메일은 발신 전용입니다.
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
