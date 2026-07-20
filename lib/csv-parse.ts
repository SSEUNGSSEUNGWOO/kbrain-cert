export type InvitationCsvRow = {
  name: string;
  phone: string;
  email?: string;
  organization?: string;
};

export type ParseResult = {
  rows: InvitationCsvRow[];
  errors: string[];
};

export function parseInvitationPaste(text: string): ParseResult {
  const rows: InvitationCsvRow[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trim();
    if (!line) continue;
    const [rawName = "", rawPhone = ""] = line.split("\t");
    const name = rawName.trim();
    const phone = rawPhone.trim();
    if (
      index === 0 &&
      ["이름", "name"].includes(name.toLowerCase()) &&
      ["전화번호", "phone"].includes(phone.toLowerCase())
    ) {
      continue;
    }
    if (!name || !phone) {
      errors.push(`${index + 1}행: 이름 또는 전화번호 없음`);
      continue;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) {
      errors.push(`${index + 1}행: 전화번호 형식 오류 (${phone})`);
      continue;
    }
    const key = `${name}:${digits.slice(-4)}`;
    if (seen.has(key)) {
      errors.push(`${index + 1}행: 이름·전화번호 뒷자리 중복 (${name})`);
      continue;
    }
    seen.add(key);
    rows.push({ name, phone });
  }

  return { rows, errors };
}

/**
 * 응시자 초대 CSV 파서 · 헤더 기반 컬럼 매칭
 * 필수: name, phone · 선택: email, organization
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
  const phoneIdx = header.indexOf("phone");
  const orgIdx = header.indexOf("organization");
  if (nameIdx < 0 || phoneIdx < 0) {
    return {
      rows: [],
      errors: ["헤더에 'name', 'phone' 컬럼이 반드시 필요합니다"],
    };
  }

  const rows: InvitationCsvRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = splitCsvLine(line).map((c) => c.trim());
    const name = cols[nameIdx];
    const phone = cols[phoneIdx];
    const email = emailIdx >= 0 ? cols[emailIdx] : "";
    if (!name || !phone) {
      errors.push(`${i + 1}행: 이름 또는 전화번호 없음`);
      continue;
    }
    if (phone.replace(/\D/g, "").length < 4) {
      errors.push(`${i + 1}행: 전화번호 형식 오류 (${phone})`);
      continue;
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) {
      errors.push(`${i + 1}행: 이메일 형식 오류 (${email})`);
      continue;
    }
    const key = `${name}:${phone.replace(/\D/g, "").slice(-4)}`;
    if (seen.has(key)) {
      errors.push(`${i + 1}행: 이름·전화번호 뒷자리 중복 (${name})`);
      continue;
    }
    seen.add(key);
    rows.push({
      name,
      phone,
      email: email || undefined,
      organization: orgIdx >= 0 ? cols[orgIdx] || undefined : undefined,
    });
  }
  return { rows, errors };
}

/** 단순 쉼표 split · 쿠오트 내부는 그대로 (심플 케이스용) */
function splitCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.replace(/^"(.*)"$/, "$1"));
}

export const CSV_TEMPLATE = `name,phone,email,organization
홍길동,010-1234-5678,applicant1@example.com,케이브레인
김철수,010-9876-5432,,DAEASY`;
