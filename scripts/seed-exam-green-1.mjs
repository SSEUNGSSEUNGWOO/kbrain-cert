/**
 * 실전세트01 · 그린 · 정책모니터링 seed (문제 + 첨부 업로드 일괄)
 * 원본: C:/kbrain/문제/7월 인증평가/그린 1,2,3/1세트_정책모니터링
 * 실행: node --env-file=.env.local scripts/seed-exam-green-1.mjs
 */
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = "exam-attachments";
const SRC = "C:/kbrain/문제/7월 인증평가/그린 1,2,3/1세트_정책모니터링";

// Supabase Storage는 key에 ASCII만 허용 → 한글 경로 hash로 대체
function safeKey(relPath) {
  const ext = path.extname(relPath);
  const hash = crypto.createHash("md5").update(relPath).digest("hex").slice(0, 12);
  return `${hash}${ext}`;
}

async function uploadFiles(storagePrefix, files) {
  const attachments = [];
  for (const f of files) {
    const abs = path.join(SRC, f.src);
    if (!fs.existsSync(abs)) {
      console.error(`  ✗ 파일 없음: ${abs}`);
      process.exit(1);
    }
    const buffer = fs.readFileSync(abs);
    const storagePath = `${storagePrefix}/${safeKey(f.name)}`;
    const contentType =
      { ".md": "text/markdown", ".csv": "text/csv", ".json": "application/json" }[
        path.extname(f.name).toLowerCase()
      ] ?? "application/octet-stream";
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: true });
    if (error) {
      console.error(`  ✗ ${f.name}: ${error.message}`);
      process.exit(1);
    }
    attachments.push({ name: f.name, path: storagePath, mime: contentType, size: buffer.length });
    console.log(`  ✓ ${f.name} (${buffer.length}B)`);
  }
  return attachments;
}

// ─── 1. 카테고리·등급 조회 ───
const { data: cats } = await supabase.from("question_categories").select("id, name");
const { data: grades } = await supabase.from("exam_grades").select("id, name");
const catId = Object.fromEntries(cats.map((c) => [c.name, c.id]));
const gradeId = Object.fromEntries(grades.map((g) => [g.name, g.id]));

const GREEN = gradeId["Green"];
const CAT_CONTENT = catId["생성형AI 활용"];
const CAT_DATA = catId["데이터 분석"];
const CAT_SERVICE = catId["서비스 구현"];
if (!GREEN || !CAT_CONTENT || !CAT_DATA || !CAT_SERVICE) {
  console.error("Missing seed data (categories/grades).");
  process.exit(1);
}

// ─── 2. 첨부 업로드 ───
console.log("[첨부 업로드] 1과목 보도자료 6건...");
const set1Files = fs
  .readdirSync(path.join(SRC, "1과목_콘텐츠/첨부/보도자료"))
  .filter((f) => f.endsWith(".md"))
  .sort()
  .map((f) => ({ src: `1과목_콘텐츠/첨부/보도자료/${f}`, name: `보도자료/${f}` }));
if (set1Files.length !== 6) {
  console.error(`보도자료 6건이어야 하는데 ${set1Files.length}건 발견`);
  process.exit(1);
}
const set1Attachments = await uploadFiles("exam-green-1/set-1", set1Files);

console.log("[첨부 업로드] 2과목 CSV...");
const set2Attachments = await uploadFiles("exam-green-1/set-2", [
  { src: "2과목_데이터분석/첨부/2025_정책사업_현황.csv", name: "2025_정책사업_현황.csv" },
]);

console.log("[첨부 업로드] 3과목 JSON...");
const set3Attachments = await uploadFiles("exam-green-1/set-3", [
  { src: "3과목_자동화/첨부/정책공지.json", name: "정책공지.json" },
]);

// ─── 3. Exam 생성 ───
const { data: exam, error: examErr } = await supabase
  .from("exams")
  .insert({
    title: "그린 인증 · 실전세트01 · 정책모니터링",
    grade_id: GREEN,
    duration_minutes: 120,
    max_participants: 100,
    status: "draft",
    instructions:
      "3과목 (콘텐츠 · 데이터분석 · 자동화) · 각 40분 권장 · 총 120분 · 배점 300점 · 100점 환산 합격 60점 · AI 챗봇(ChatGPT · Claude · Gemini 등) 자유 활용",
    registration_mode: "invite_only",
    pass_score: 60,
    entry_start_minutes: 30,
    alert_event_types: ["multiple_faces", "fullscreen_exit", "recording_error"],
    custom_texts: {
      welcome:
        "시나리오형 정책모니터링 실전 세트입니다. 각 과목의 첨부 자료를 반드시 다운로드하여 사용하세요. 정수 답은 콤마·단위 없이 숫자만 입력합니다.",
    },
  })
  .select()
  .single();
if (examErr) {
  console.error("Exam create error:", examErr.message);
  process.exit(1);
}
console.log(`✓ Exam: ${exam.title} (${exam.id})`);

// ─── 4. Question Sets ───
const setsData = [
  {
    title: "그린1 · 1과목 · 콘텐츠",
    scenario:
      "당신은 행정안전부 정책기획관실 소속 주무관입니다. 최근 행정안전부가 발표한 정책 보도자료를 AI를 활용해 분석하고, 주요 수치와 현황을 정리·분류하는 업무를 맡았습니다.\n\n첨부 안내:\n- 첨부/보도자료/ 폴더 안의 .md 파일 6건\n- 각 파일 끝에 담당자 부서·전화번호가 명시되어 있습니다.\n- AI 챗봇에 파일 내용을 붙여넣고 질문하거나 직접 읽어 풀어도 됩니다.\n\n허용 도구: AI 챗봇(ChatGPT · Claude · Gemini 등) 자유 활용\n정수 답은 콤마·단위 없이 숫자만 입력해주세요.",
    attachments: set1Attachments,
    total_score: 100,
    order_num: 1,
    category_id: CAT_CONTENT,
    grade_id: GREEN,
    proctoring_disabled: true, // AI 보조 허용
  },
  {
    title: "그린1 · 2과목 · 데이터분석",
    scenario:
      "당신은 행정안전부 정책기획관실 주무관입니다. 2025년 정책모니터링 사업 현황(가상) 정본 표를 활용해 정책분야별 현황을 분석합니다.\n\n첨부: 2025_정책사업_현황.csv\n\n사용 도구: AI 챗봇, Excel 및 본인 코드 자유 활용\n정수 답은 콤마·단위 없이 숫자만 입력해주세요.",
    attachments: set2Attachments,
    total_score: 100,
    order_num: 2,
    category_id: CAT_DATA,
    grade_id: GREEN,
    proctoring_disabled: true,
  },
  {
    title: "그린1 · 3과목 · 자동화",
    scenario:
      "당신은 행정안전부 대변인실 주무관입니다. 부처 직원이 정책 공지사항을 빠르게 찾을 수 있는 한 페이지짜리 정적 도구를 만들어 배포합니다.\n\n첨부 JSON 데이터(정책공지.json · 공지 10건 · 필드: id, 분야, 제목, 담당과, 연락처)를 HTML 파일 안 <script> 블록에 자바스크립트 변수로 선언하여, 단일 HTML 파일만 배포해도 동작하도록 작성해주세요.\n\n사용 도구: ChatGPT·Claude·v0·Lovable 자유. HTML/CSS/JS 정적 페이지 + Netlify·Vercel·GitHub Pages 등 무료 정적 호스팅 배포.\n\n필수 기능:\n1. JSON 10건을 한 페이지에 카드 형태로 표시 (제목·분야·담당과·연락처)\n2. 검색 기능: 제목 또는 분야 키워드로 필터링 + \"결과 N건\" 표시\n3. 분야별 필터: 분야 버튼 또는 <select>로 카드 필터링\n\nURL은 채점 기간(제출 후 7일) 동안 접근 가능해야 합니다.",
    attachments: set3Attachments,
    total_score: 100,
    order_num: 3,
    category_id: CAT_SERVICE,
    grade_id: GREEN,
    proctoring_disabled: true,
  },
];

const setIds = [];
for (const s of setsData) {
  const { data, error } = await supabase.from("question_sets").insert(s).select().single();
  if (error) {
    console.error(`Set "${s.title}" error:`, error.message);
    process.exit(1);
  }
  setIds.push(data);
  console.log(`✓ Set: ${data.title} (${data.id})`);
  await supabase.from("exam_sets").insert({ exam_id: exam.id, set_id: data.id, order_num: s.order_num });
}
const [set1, set2, set3] = setIds;

// ─── 5. Questions (rubric은 채점자 전용 · 응시자 뷰에서 제외됨) ───
const questions = [
  // 1과목 콘텐츠
  {
    code: "GREEN-S1-M1-Q1",
    category_id: CAT_CONTENT,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["정책모니터링", "보도자료"],
    content:
      "행정안전부가 올해 3월 지방정부의 빗물받이 정비 지원을 위해 교부한 재난안전특별교부세 금액은 얼마입니까? (억 원 단위, 숫자만 입력해주세요)",
    submission_slots: [{ id: "answer", type: "number", label: "정수 답", max_score: 15 }],
    max_score: 15,
    rubric: {
      answer: 326,
      criteria: "정수 326만 정답. 단위(억·억 원) 포함 시 오답.",
      wrong_patterns: ["326억 원 (단위 포함) → 0점", "408 (빗물받이 개소 수 혼동) → 0점"],
    },
    set_id: set1.id,
    set_order: 1,
  },
  {
    code: "GREEN-S1-M1-Q2",
    category_id: CAT_CONTENT,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["정책모니터링", "보도자료"],
    content: "한국-프랑스 수교 기념 특별전의 근거가 되는 조불수호통상조약 체결 연도는 몇 년입니까?",
    submission_slots: [{ id: "answer", type: "number", label: "정수 (연도)", max_score: 15 }],
    max_score: 15,
    rubric: {
      answer: 1886,
      criteria: "정수 1886만 정답.",
      wrong_patterns: ["140 (주년 수 혼동) → 0점", "2025·2026 (개최 연도 혼동) → 0점"],
    },
    set_id: set1.id,
    set_order: 2,
  },
  {
    code: "GREEN-S1-M1-Q3",
    category_id: CAT_CONTENT,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["정책모니터링", "보도자료"],
    content:
      "여성리더양성과정이 처음 개설된 이래 지난해까지 배출된 누적 수료생 수는 몇 명입니까? (올해 교육 중인 인원은 제외, 숫자만 입력해주세요)",
    submission_slots: [{ id: "answer", type: "number", label: "정수 답", max_score: 20 }],
    max_score: 20,
    rubric: {
      answer: 1577,
      criteria: "정수 1577만 정답. 콤마 포함(1,577) 허용.",
      wrong_patterns: [
        "180 (이번 교육 참여 인원 혼동) → 0점",
        "43 (올해 과정 참여 인원 혼동) → 0점",
        "32 (기수 수 혼동) → 0점",
      ],
    },
    set_id: set1.id,
    set_order: 3,
  },
  {
    code: "GREEN-S1-M1-Q4",
    category_id: CAT_CONTENT,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["정책모니터링", "보도자료"],
    content:
      "민생회복 소비쿠폰 국민 인식 조사(한국리서치 위탁)의 표본 수는 몇 명입니까? (숫자만 입력해주세요)",
    submission_slots: [{ id: "answer", type: "number", label: "정수 답", max_score: 20 }],
    max_score: 20,
    rubric: {
      answer: 1000,
      criteria: "정수 1000만 정답. 콤마 포함(1,000) 허용.",
      wrong_patterns: ["84·84.6 (응답 비율 혼동) → 0점", "73·73.6 (응답 비율 혼동) → 0점"],
    },
    set_id: set1.id,
    set_order: 4,
  },
  {
    code: "GREEN-S1-M1-Q5",
    category_id: CAT_CONTENT,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["정책모니터링", "보도자료"],
    content:
      "개정된 「지방공무원법」에 따라 육아휴직을 사용할 수 있는 자녀 나이의 상한은 몇 세입니까? (숫자만 입력해주세요)",
    submission_slots: [{ id: "answer", type: "number", label: "정수 답", max_score: 20 }],
    max_score: 20,
    rubric: {
      answer: 12,
      criteria: "정수 12만 정답.",
      wrong_patterns: ["8 (기존 상한 혼동) → 0점", "6 (난임 휴직 유예기간 혼동) → 0점"],
    },
    set_id: set1.id,
    set_order: 5,
  },
  {
    code: "GREEN-S1-M1-Q6",
    category_id: CAT_CONTENT,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["정책모니터링", "제출파일", "CSV"],
    content:
      "보도자료_분류표.csv를 작성하여 제출해주세요.\n- 내용: 보도자료 6건의 파일번호와 본문 마지막 연락처 정보를 담은 표\n- 인코딩: UTF-8 (엑셀에서 한글이 깨지지 않도록 저장)\n- 헤더 1행 + 데이터 6행\n- 컬럼: 파일번호,담당부서,담당자,전화번호\n- 정렬: 파일번호 오름차순\n\n| 컬럼 | 형식 | 예시 |\n|---|---|---|\n| 파일번호 | 파일명에서 보도자료_ 접두어와 .md를 제거한 숫자 | 125874 |\n| 담당부서 | 본문 마지막 연락처에서 사람 이름 바로 앞의 ○○과 단위만 입력 | 지방인사제도과 |\n| 담당자 | 본문 마지막 연락처에 표시된 사람 이름 | 김정민 |\n| 전화번호 | 본문 마지막 연락처의 전화번호를 하이픈 포함 그대로 입력 | 044-205-3347 |",
    submission_slots: [
      { id: "csv", type: "file", label: "보도자료_분류표.csv", max_score: 10, accept: ".csv" },
    ],
    max_score: 10,
    rubric: {
      criteria:
        "정답표와 행별 비교 · 파일번호·담당부서·담당자·전화번호 정확 일치(전화번호는 하이픈 포함) · 파일번호 오름차순 6행 + 헤더 1행",
      error_handling: [
        "행 수 초과(7행 이상): 행 수 배점 0점 후 나머지 채점",
        "파일번호 형식 오류(보도자료_ 접두어 포함 등): 해당 행 오답",
        "담당부서 오탈자: 오답",
      ],
      note: "해설.pdf의 비교 컬럼(발표기관·제목)은 구버전 · 문제지_수정본 컬럼 기준으로 채점",
    },
    set_id: set1.id,
    set_order: 6,
  },

  // 2과목 데이터분석
  {
    code: "GREEN-S1-M2-Q1",
    category_id: CAT_DATA,
    grade_id: GREEN,
    difficulty: "쉬움",
    tags: ["데이터분석", "CSV"],
    content: "전체 사업은 모두 몇 건입니까?",
    submission_slots: [{ id: "answer", type: "number", label: "정수 답", max_score: 15 }],
    max_score: 15,
    rubric: {
      answer: 300,
      criteria: "정수 300만 정답.",
      wrong_patterns: ["299·301 (헤더/빈 행 카운트 오류) → 0점"],
    },
    set_id: set2.id,
    set_order: 1,
  },
  {
    code: "GREEN-S1-M2-Q2",
    category_id: CAT_DATA,
    grade_id: GREEN,
    difficulty: "쉬움",
    tags: ["데이터분석", "집계"],
    content: "정책분야별 사업 수가 가장 많은 분야의 이름은 무엇입니까?",
    submission_slots: [{ id: "answer", type: "text", label: "한글 단답", max_score: 15 }],
    max_score: 15,
    rubric: {
      answer: "균형발전",
      criteria: "'균형발전' 정확 일치.",
      wrong_patterns: ["디지털혁신 등 (일부 분야만 카운트) → 0점"],
    },
    set_id: set2.id,
    set_order: 2,
  },
  {
    code: "GREEN-S1-M2-Q3",
    category_id: CAT_DATA,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["데이터분석", "필터"],
    content: "예산이 100억원 이상인 사업은 몇 건입니까?",
    submission_slots: [{ id: "answer", type: "number", label: "정수 답", max_score: 20 }],
    max_score: 20,
    rubric: {
      answer: 153,
      criteria: "정수 153만 정답. 100억 '이상'(≥) 기준.",
      wrong_patterns: ["초과(>) 사용으로 다른 수 → 0점"],
    },
    set_id: set2.id,
    set_order: 3,
  },
  {
    code: "GREEN-S1-M2-Q4",
    category_id: CAT_DATA,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["데이터분석", "정렬"],
    content: "예산 1위 사업의 사업번호는 무엇입니까? (P25-NNN 형식 그대로)",
    submission_slots: [{ id: "answer", type: "text", label: "사업번호 (P25-NNN)", max_score: 20 }],
    max_score: 20,
    rubric: {
      answer: "P25-225",
      criteria: "'P25-225' 정확 일치 · 하이픈 형식 그대로.",
    },
    set_id: set2.id,
    set_order: 4,
  },
  {
    code: "GREEN-S1-M2-Q5",
    category_id: CAT_DATA,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["데이터분석", "집계"],
    content: "전체 사업의 예산 총합은 얼마입니까? (억원, 숫자만 입력해주세요)",
    submission_slots: [{ id: "answer", type: "number", label: "정수 (억원)", max_score: 20 }],
    max_score: 20,
    rubric: {
      answer: 30360,
      criteria: "정수 30360만 정답. 콤마·단위 없이.",
    },
    set_id: set2.id,
    set_order: 5,
  },
  {
    code: "GREEN-S1-M2-Q6",
    category_id: CAT_DATA,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["데이터분석", "제출파일", "CSV"],
    content:
      "분야별_예산집계.csv를 작성하여 제출해주세요.\n- 헤더: 정책분야,사업수,예산합계_억원\n- 데이터: 정책분야당 1행, 총 8행\n- 정렬: 사업수 내림차순, 사업수가 같으면 정책분야 가나다순\n- 인코딩: UTF-8",
    submission_slots: [
      { id: "csv", type: "file", label: "분야별_예산집계.csv", max_score: 10, accept: ".csv" },
    ],
    max_score: 10,
    rubric: {
      criteria:
        "헤더 '정책분야,사업수,예산합계_억원' · 8행 · 사업수 내림차순(동수 시 가나다순) · UTF-8 · 수치는 원본 CSV 집계와 일치",
    },
    set_id: set2.id,
    set_order: 6,
  },

  // 3과목 자동화
  {
    code: "GREEN-S1-M3-Q1",
    category_id: CAT_SERVICE,
    grade_id: GREEN,
    difficulty: "보통",
    tags: ["자동화", "웹배포", "정적페이지"],
    content:
      "정책 공지 검색 정적 페이지를 만들어 무료 호스팅(Netlify · Vercel · GitHub Pages 등)에 배포하고, 배포 URL과 index.html 소스를 제출하세요.\n\n필수 기능:\n1. 첨부 정책공지.json 10건을 한 페이지에 카드 형태로 표시 (제목·분야·담당과·연락처)\n2. 검색: 제목 또는 분야 키워드로 필터링 + \"결과 N건\" 표시\n3. 분야별 필터: 분야 버튼 또는 <select>\n\n작성 규칙: JSON 데이터를 HTML 파일 안 <script> 블록에 자바스크립트 변수로 선언하여 단일 HTML 파일만으로 동작해야 합니다.\nURL은 채점 기간(제출 후 7일) 동안 접근 가능해야 합니다.",
    submission_slots: [
      { id: "url", type: "url", label: "배포된 페이지 URL (80점)", max_score: 80 },
      { id: "source", type: "file", label: "index.html 소스 (20점)", max_score: 20, accept: ".html" },
    ],
    max_score: 100,
    rubric: {
      criteria:
        "URL(80점) — 권장 배점: 정상 로드 20 · 카드 10건 표시(제목·분야·담당과·연락처) 20 · 검색+결과 N건 20 · 분야별 필터 20. 소스(20점) — index.html에 JSON 데이터 <script> 변수 포함 + 단일 파일 동작 여부.",
      note: "해설.pdf는 구버전(카드뉴스 갤러리) 기준이라 사용 불가 · 문제지.md 필수 기능 기준. URL 접근 불가(404) 시 URL 배점 0점. 디자인·레이아웃은 채점 항목 아님.",
    },
    set_id: set3.id,
    set_order: 1,
  },
];

console.log(`\nInserting ${questions.length} questions...`);
const { data: insertedQuestions, error: qErr } = await supabase
  .from("questions")
  .insert(questions)
  .select("id, code");
if (qErr) {
  console.error("Questions insert error:", qErr.message);
  process.exit(1);
}
console.log(`✓ ${insertedQuestions.length} questions inserted`);

const examQuestionsMap = insertedQuestions.map((q, i) => ({
  exam_id: exam.id,
  question_id: q.id,
  order_num: i + 1,
}));
const { error: eqErr } = await supabase.from("exam_questions").insert(examQuestionsMap);
if (eqErr) {
  console.error("exam_questions error:", eqErr.message);
  process.exit(1);
}
console.log(`✓ exam_questions mapping: ${examQuestionsMap.length} rows`);

console.log("\n✅ Seed 완료:");
console.log(`   - Exam: ${exam.title} (draft) · id=${exam.id}`);
console.log(`   - 3 sets · ${insertedQuestions.length} questions · 100+100+100=300점`);
console.log(`   - 첨부: 보도자료 6 + CSV 1 + JSON 1`);
console.log("\n다음 단계: 관리자 페이지에서 exam_date(내일 10:00)·open 전환 · 응시자 명단 등록");
