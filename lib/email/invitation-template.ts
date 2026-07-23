/**
 * 응시 안내 이메일 HTML 템플릿
 * - 관리자가 발송 전 미리보기 + 복사해서 Outlook/Gmail 등에 붙여넣기용
 * - Table 기반 · Inline CSS · Outlook/Naver/Gmail/Daum 호환
 * - 편집 디자인 럭셔리 인증서 톤 · 골드 프레임 · 로마 숫자 넘버링
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

  const specs: Array<{ roman: string; enLabel: string; koLabel: string; value: string }> = [];
  if (targetAudience) {
    specs.push({
      roman: "I",
      enLabel: "TARGET",
      koLabel: "평가 대상",
      value: targetAudience,
    });
  }
  specs.push({
    roman: romanize(specs.length + 1),
    enLabel: "SCHEDULE",
    koLabel: "평가 기간",
    value: data.examPeriod,
  });
  specs.push({
    roman: romanize(specs.length + 1),
    enLabel: "DURATION",
    koLabel: "소요 시간",
    value: `${data.durationMinutes}분`,
  });
  specs.push({
    roman: romanize(specs.length + 1),
    enLabel: "FORMAT",
    koLabel: "평가 방식",
    value: format,
  });

  const specRows = specs
    .map(
      (spec) => `
          <tr>
            <td style="padding:18px 0;border-top:1px solid rgba(201,164,94,0.22);">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="width:68px;vertical-align:top;">
                    <div style="color:#C9A45E;font-size:11px;font-weight:700;letter-spacing:3px;font-family:'Courier New',Courier,monospace;">— ${spec.roman}</div>
                  </td>
                  <td style="vertical-align:top;">
                    <div style="color:#8A8DBF;font-size:10px;font-weight:700;letter-spacing:2.5px;margin-bottom:4px;">${spec.enLabel} · ${escapeHtml(spec.koLabel)}</div>
                    <div style="color:#ffffff;font-size:15px;font-weight:600;line-height:1.5;">${escapeHtml(spec.value)}</div>
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
<body style="margin:0;padding:32px 16px;background:#050B1D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Malgun Gothic','Apple SD Gothic Neo',sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:620px;margin:0 auto;">

    <tr>
      <td style="height:4px;background:#C9A45E;line-height:0;font-size:0;">&nbsp;</td>
    </tr>

    <tr>
      <td style="background:#0B1B3D;padding:44px 48px 40px 48px;">

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="vertical-align:middle;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width:34px;height:34px;background:#C9A45E;color:#0B1B3D;text-align:center;vertical-align:middle;font-weight:900;font-size:16px;line-height:34px;">D</td>
                  <td style="padding-left:12px;color:#C9A45E;font-size:11px;font-weight:700;letter-spacing:4px;font-family:'Courier New',Courier,monospace;">DAEASY · CERT</td>
                </tr>
              </table>
            </td>
            <td style="text-align:right;color:#8A8DBF;font-size:10px;font-weight:700;letter-spacing:3px;font-family:'Courier New',Courier,monospace;">N˚ AI · 2026</td>
          </tr>
        </table>

        <div style="border-top:1px solid rgba(201,164,94,0.25);margin:24px 0 52px 0;line-height:0;font-size:0;">&nbsp;</div>

        <div style="text-align:center;">
          <div style="color:#C9A45E;font-size:10px;letter-spacing:6px;margin-bottom:18px;font-weight:700;font-family:'Courier New',Courier,monospace;">
            ◆ &nbsp; COMPETENCY ASSESSMENT &nbsp; ◆
          </div>
          <div style="color:#ffffff;font-size:34px;font-weight:900;margin:0 0 24px 0;letter-spacing:-0.8px;line-height:1.2;">
            AI 챔피언<br>역량평가 안내
          </div>
          <p style="color:#A8B0C4;font-size:14px;line-height:1.85;margin:0 0 48px 0;">
            그동안 갈고닦은 AI 역량을 확인하는 시간입니다.<br>
            아래 정보를 확인하신 후 평가에 참여해 주세요.
          </p>
        </div>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:52px;">
          ${specRows}
          <tr>
            <td style="border-top:1px solid rgba(201,164,94,0.22);height:0;line-height:0;font-size:0;">&nbsp;</td>
          </tr>
        </table>

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td align="center">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background:#C9A45E;">
                    <a href="${escapeAttr(entryUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;color:#0B1B3D;padding:20px 60px;text-decoration:none;font-size:15px;font-weight:800;letter-spacing:0.5px;">
                      역량평가 바로가기 &nbsp;→
                    </a>
                  </td>
                </tr>
              </table>
              <div style="color:#C9A45E;font-size:10px;margin:18px 0 0 0;font-family:'Courier New',Courier,monospace;letter-spacing:4px;font-weight:700;">
                — &nbsp; CLICK TO START &nbsp; —
              </div>
            </td>
          </tr>
        </table>

      </td>
    </tr>

    <tr>
      <td style="background:#ffffff;padding:36px 48px 28px 48px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="width:22px;vertical-align:top;padding:6px 0 0 0;">
              <div style="width:6px;height:6px;background:#C9A45E;">&nbsp;</div>
            </td>
            <td style="color:#111;font-size:12.5px;line-height:1.85;padding:2px 0 12px 0;">
              안정적인 네트워크 환경에서 PC로 접속해 주세요.
            </td>
          </tr>
          <tr>
            <td style="width:22px;vertical-align:top;padding:6px 0 0 0;">
              <div style="width:6px;height:6px;background:#C9A45E;">&nbsp;</div>
            </td>
            <td style="color:#111;font-size:12.5px;line-height:1.85;padding:2px 0;">
              문의: <span style="font-weight:700;">${escapeHtml(contact)}</span>
            </td>
          </tr>
        </table>
        <div style="border-top:1px solid #E5E7EB;margin:26px 0 16px 0;line-height:0;font-size:0;">&nbsp;</div>
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
          <tr>
            <td style="color:#6B7280;font-size:10px;letter-spacing:2.5px;font-weight:700;font-family:'Courier New',Courier,monospace;">
              KBRAINC · DAEASY
            </td>
            <td style="text-align:right;color:#9CA3AF;font-size:10.5px;">
              본 메일은 발신 전용입니다.
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td style="height:4px;background:#C9A45E;line-height:0;font-size:0;">&nbsp;</td>
    </tr>

  </table>
</body>
</html>`;
}

function romanize(n: number): string {
  const map: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
    5: "V",
    6: "VI",
    7: "VII",
    8: "VIII",
  };
  return map[n] ?? String(n);
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
