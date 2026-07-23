/**
 * 응시 안내 이메일 HTML 템플릿
 * - 관리자가 발송 전 미리보기 + 복사해서 Outlook/Gmail 등에 붙여넣기용
 * - Table 기반 · Inline CSS · Outlook/Naver/Gmail/Daum 호환
 * - 여백과 심플함 중심 · 프레임 없이 열린 느낌
 */

export type InvitationEmailData = {
  examTitle: string;
  examPeriod: string;
  durationMinutes: number;
  entryUrl: string;
  contact?: string;
  format?: string;
  targetAudience?: string;
};

export function renderInvitationEmail(data: InvitationEmailData): string {
  const contact = data.contact ?? "{담당자 및 연락처}";
  const format = data.format ?? "CBT · 원격 감독";
  const entryUrl = data.entryUrl;
  const targetAudience = data.targetAudience?.trim();

  const specs: Array<{ label: string; value: string }> = [];
  if (targetAudience) {
    specs.push({ label: "평가 대상", value: targetAudience });
  }
  specs.push({ label: "평가 기간", value: data.examPeriod });
  specs.push({ label: "소요 시간", value: `${data.durationMinutes}분` });
  specs.push({ label: "평가 방식", value: format });

  const specRows = specs
    .map(
      (spec, i) => `
          <tr>
            <td style="padding:${i === 0 ? "0" : "18px"} 0 18px 0;${i === 0 ? "" : "border-top:1px solid #EEEFF2;"}">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="width:110px;vertical-align:top;color:#8892A6;font-size:13px;font-weight:500;">
                    ${escapeHtml(spec.label)}
                  </td>
                  <td style="color:#1A2333;font-size:15px;font-weight:600;line-height:1.5;">
                    ${escapeHtml(spec.value)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.examTitle)} 안내</title>
</head>
<body style="margin:0;padding:0;background:#F0F4FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" bgcolor="#F0F4FA" style="background:#F0F4FA;">
<tr>
<td align="center" style="padding:40px 16px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:560px;margin:0 auto;">

    <tr>
      <td bgcolor="#ffffff" style="background:#ffffff;padding:56px 48px;border-radius:16px;">

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:48px;">
          <tr>
            <td style="color:#0B1B3D;font-size:14px;font-weight:700;letter-spacing:-0.2px;">
              ${escapeHtml(data.examTitle)}
            </td>
            <td style="text-align:right;color:#8892A6;font-size:12px;font-weight:500;">
              응시 안내
            </td>
          </tr>
        </table>

        <div style="color:#0B1B3D;font-size:34px;font-weight:800;letter-spacing:-1px;line-height:1.25;margin-bottom:20px;">
          ${escapeHtml(data.examTitle)} 안내
        </div>
        <p style="color:#6B7280;font-size:15px;line-height:1.75;margin:0 0 48px 0;">
          그동안 갈고닦은 AI 역량을 확인하는 시간입니다.<br>
          아래 정보를 확인하신 후 평가에 참여해 주세요.
        </p>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:44px;">
          ${specRows}
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:44px;">
          <tr>
            <td>
              <a href="${escapeAttr(entryUrl)}" target="_blank" rel="noopener noreferrer" style="display:block;background:#0B1B3D;color:#ffffff;padding:18px 24px;text-decoration:none;font-size:15px;font-weight:700;text-align:center;border-radius:10px;letter-spacing:-0.1px;">
                역량평가 바로가기 →
              </a>
            </td>
          </tr>
        </table>

        <div style="border-top:1px solid #EEEFF2;padding-top:28px;">
          <div style="color:#1A2333;font-size:13.5px;line-height:1.85;margin-bottom:6px;">
            안정적인 네트워크 환경에서 PC로 접속해 주세요.
          </div>
          <div style="color:#1A2333;font-size:13.5px;line-height:1.85;">
            문의 <span style="color:#0B1B3D;font-weight:600;">${escapeHtml(contact)}</span>
          </div>
        </div>

      </td>
    </tr>

    <tr>
      <td style="padding:24px 8px 0 8px;text-align:center;color:#8892A6;font-size:11.5px;line-height:1.7;">
        본 메일은 발신 전용입니다.
      </td>
    </tr>

  </table>
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
