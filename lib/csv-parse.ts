export type InvitationCsvRow = {
  email: string;
  name?: string;
  organization?: string;
};

export type ParseResult = {
  rows: InvitationCsvRow[];
  errors: string[];
};

/**
 * 응시자 초대 CSV 파서 · 헤더 기반 컬럼 매칭
 * 필수: email · 선택: name, organization
 * - BOM/공백 제거 · 쉼표 구분 (쿠오트 내부 쉼표는 지원 안 함 · 단순 케이스만)
 * - 각 행별 오류는 errors에 누적 (파싱 계속)
 */
export function parseInvitationCsv(text: string): ParseResult {
  const errors: string[] = [];
  const clean = text.replace(/^﻿/, "").trim();
  if (!clean) return { rows: [], errors: ["파일이 비어있습니다"] };

  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { rows: [], errors: ["헤더 + 최소 1개 데이터 행이 필요합니다"] };
  }

  const header = splitCsvLine(lines[0]).map((c) => c.trim().toLowerCase());
  const emailIdx = header.indexOf("email");
  const nameIdx = header.indexOf("name");
  const orgIdx = header.indexOf("organization");
  if (emailIdx < 0) {
    return {
      rows: [],
      errors: ["헤더에 'email' 컬럼이 반드시 필요합니다"],
    };
  }

  const rows: InvitationCsvRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = splitCsvLine(line).map((c) => c.trim());
    const email = cols[emailIdx];
    if (!email) {
      errors.push(`${i + 1}행: 이메일 없음`);
      continue;
    }
    const emailLower = email.toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      errors.push(`${i + 1}행: 이메일 형식 오류 (${email})`);
      continue;
    }
    if (seen.has(emailLower)) {
      errors.push(`${i + 1}행: 중복 (${email})`);
      continue;
    }
    seen.add(emailLower);
    rows.push({
      email,
      name: nameIdx >= 0 ? cols[nameIdx] || undefined : undefined,
      organization: orgIdx >= 0 ? cols[orgIdx] || undefined : undefined,
    });
  }
  return { rows, errors };
}

/** 단순 쉼표 split · 쿠오트 내부는 그대로 (심플 케이스용) */
function splitCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.replace(/^"(.*)"$/, "$1"));
}

export const CSV_TEMPLATE = `email,name,organization
applicant1@example.com,홍길동,케이브레인
applicant2@example.com,김철수,DAEASY
applicant3@example.com,,`;
