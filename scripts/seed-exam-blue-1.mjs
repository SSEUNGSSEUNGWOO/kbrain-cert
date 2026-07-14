/**
 * 실전세트01 · 블루 · 정책모니터링 · 실 데이터 seed
 * 실행: node --env-file=.env.local scripts/seed-exam-blue-1.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing env vars in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── 1. 카테고리·등급 조회 ───
const { data: cats } = await supabase
  .from("question_categories")
  .select("id, name");
const { data: grades } = await supabase.from("exam_grades").select("id, name");
const catId = Object.fromEntries(cats.map((c) => [c.name, c.id]));
const gradeId = Object.fromEntries(grades.map((g) => [g.name, g.id]));

const BLUE = gradeId["Blue"];
const CAT_CONTENT = catId["생성형AI 활용"];
const CAT_DATA = catId["데이터 분석"];
const CAT_SERVICE = catId["서비스 구현"];

if (!BLUE || !CAT_CONTENT || !CAT_DATA || !CAT_SERVICE) {
  console.error("Missing seed data (categories/grades). Run initial migration first.");
  process.exit(1);
}

// ─── 2. Exam 생성 ───
const { data: exam, error: examErr } = await supabase
  .from("exams")
  .insert({
    title: "블루 인증 · 실전세트01 · 정책모니터링",
    grade_id: BLUE,
    duration_minutes: 120,
    max_participants: 100,
    status: "draft",
    instructions:
      "3과목 (콘텐츠 · 데이터분석 · 자동화) · 각 40분 · 총 120분 · 배점 300점 · 100점 환산 합격 60점",
    registration_mode: "invite_only",
    pass_score: 60,
    entry_start_minutes: 30,
    alert_event_types: ["multiple_faces", "fullscreen_exit", "recording_error"],
    custom_texts: {
      welcome:
        "시나리오형 정책모니터링 실전 세트입니다. 각 과목의 첨부 자료를 반드시 다운로드하여 사용하세요.",
    },
  })
  .select()
  .single();

if (examErr) {
  console.error("Exam create error:", examErr.message);
  process.exit(1);
}
console.log(`✓ Exam: ${exam.title} (${exam.id})`);

// ─── 3. Question Sets (3과목) ───
const setsData = [
  {
    title: "1과목 · 콘텐츠",
    scenario:
      "당신은 행정안전부 디지털혁신과 정책모니터링 담당자입니다. 최근 발표된 정책 관련 보도자료 6건을 Python으로 분석하고, 사전 자료(부서_사전.json · 정책영역_사전.json)와 결합해 부서·정책영역별 분류 보고서를 정리합니다.\n\n첨부 안내:\n- 자료묶음.zip 다운로드 후 압축 해제 사용\n- 보도자료: 첨부/보도자료/1차분/, 첨부/보도자료/2차분/\n- 부서·정책영역 사전: 첨부/부서_사전.json, 첨부/정책영역_사전.json\n- 보도자료_125917 (1).md 파일은 125917.md의 중복본 — 분석에서 제외\n- 본문 분석 시 메타 헤더는 제외하고 나머지 텍스트를 본문으로 봅니다.",
    attachments: [
      { name: "1과목_자료묶음.zip", path: "exam-blue-1/set-1/자료묶음.zip" },
    ],
    total_score: 100,
    order_num: 1,
    category_id: CAT_CONTENT,
    grade_id: BLUE,
    proctoring_disabled: true, // AI 보조 허용
  },
  {
    title: "2과목 · 데이터분석",
    scenario:
      "당신은 행정안전부 정책기획조정실 소속 사무관입니다. 정책사업 현황 데이터와 사업성과 현황 데이터를 병합·전처리한 뒤, 머신러닝 회귀(regression) 모델을 구축하여 사업의 KPI달성률(%)을 예측하는 분석 업무를 맡았습니다.\n\n데이터 처리 규칙:\n- 두 CSV를 공통 키 컬럼으로 inner merge\n- 결측치: 타겟(KPI달성률_퍼센트) 또는 만족도_점이 결측인 행은 제거. 집행률_퍼센트·수혜인원 결측은 각 컬럼의 중앙값으로 대체\n- 이상치: 예산_억원과 고용창출_명이 평균에서 표준편차의 3배를 벗어나는 행 제거\n- 라벨 정의: KPI달성률_퍼센트 ≥ 70 → 1(목표달성), 미만 → 0(미달)",
    attachments: [
      { name: "2과목_자료묶음.zip", path: "exam-blue-1/set-2/자료묶음.zip" },
    ],
    total_score: 100,
    order_num: 2,
    category_id: CAT_DATA,
    grade_id: BLUE,
    proctoring_disabled: true,
  },
  {
    title: "3과목 · 자동화",
    scenario:
      "당신은 행정안전부 균형발전정책과 담당자입니다. 지역균형발전 사업 데이터와 재정자립도 현황을 활용해 두 가지 산출물을 만들어주세요.\n\n1) 정적 웹 페이지 — 사업 카드 검색·필터링 페이지를 무료 호스팅에 배포\n2) Python 자동화 도구 — CSV 데이터를 읽어 통계 요약을 자동 산출하는 스크립트\n\n첨부:\n- 지역균형발전_사업.csv (500행)\n- 재정자립도_현황.csv (17행)\n- 카드뉴스1~8.jpg (정적 페이지에 활용)\n\n산출물 ①·정적 검색·필터 페이지: <title>에 '지역균형발전' 또는 '사업검색' 포함 · 사업 카드 표시 · 검색/필터 · 결과 N건 · 카드뉴스 1장 이상 · korea.kr RSS 피드 5건 이상 임베드",
    attachments: [
      { name: "3과목_자료묶음.zip", path: "exam-blue-1/set-3/자료묶음.zip" },
    ],
    total_score: 100,
    order_num: 3,
    category_id: CAT_SERVICE,
    grade_id: BLUE,
    proctoring_disabled: true,
  },
];

const setIds = [];
for (const s of setsData) {
  const { data, error } = await supabase
    .from("question_sets")
    .insert(s)
    .select()
    .single();
  if (error) {
    console.error(`Set "${s.title}" error:`, error.message);
    process.exit(1);
  }
  setIds.push(data);
  console.log(`✓ Set: ${data.title} (${data.id})`);

  await supabase.from("exam_sets").insert({
    exam_id: exam.id,
    set_id: data.id,
    order_num: s.order_num,
  });
}

const [set1, set2, set3] = setIds;

// ─── 4. Questions ───
const questions = [
  // Set 1 · 1과목 콘텐츠
  {
    code: "BLUE-S1-M1-Q1",
    category_id: CAT_CONTENT,
    grade_id: BLUE,
    difficulty: "보통",
    tags: ["정책모니터링", "Python", "메타분석"],
    content:
      "6건의 메타 헤더에 등장하는 담당 부서의 종류는 모두 몇 개입니까?",
    submission_slots: [
      { id: "answer", type: "number", label: "정수 답", max_score: 15 },
    ],
    max_score: 15,
    set_id: set1.id,
    set_order: 1,
  },
  {
    code: "BLUE-S1-M1-Q2",
    category_id: CAT_CONTENT,
    grade_id: BLUE,
    difficulty: "보통",
    tags: ["정책모니터링", "Python"],
    content:
      "6건의 메타 헤더에 명시된 발표일이 가장 빠른 파일의 담당 부서명은 무엇입니까?",
    submission_slots: [
      { id: "answer", type: "text", label: "한글 단답", max_score: 15 },
    ],
    max_score: 15,
    set_id: set1.id,
    set_order: 2,
  },
  {
    code: "BLUE-S1-M1-Q3",
    category_id: CAT_CONTENT,
    grade_id: BLUE,
    difficulty: "어려움",
    tags: ["정책모니터링", "Python", "키워드분석"],
    content:
      "정책영역_사전.json의 5개 영역별 키워드를 보도자료 6건 본문 전체에서 합산할 때, 가장 많이 등장한 영역명은 무엇입니까? (사전의 영역 키 그대로)",
    submission_slots: [
      { id: "answer", type: "text", label: "영역명 (한글)", max_score: 20 },
    ],
    max_score: 20,
    set_id: set1.id,
    set_order: 3,
  },
  {
    code: "BLUE-S1-M1-Q4",
    category_id: CAT_CONTENT,
    grade_id: BLUE,
    difficulty: "어려움",
    tags: ["정책모니터링", "Python", "매핑"],
    content:
      "보도자료별로 각 영역의 키워드 등장 합산이 정책영역_사전.json의 임계값 이상이면 그 보도자료를 해당 영역에 분류합니다. 6건 × 5영역 매핑에서 분류된 (보도자료 × 영역) 매핑 총 건수는? (한 보도자료가 여러 영역에 분류될 수 있음)",
    submission_slots: [
      { id: "answer", type: "number", label: "정수 답", max_score: 20 },
    ],
    max_score: 20,
    set_id: set1.id,
    set_order: 4,
  },
  {
    code: "BLUE-S1-M1-Q5",
    category_id: CAT_CONTENT,
    grade_id: BLUE,
    difficulty: "보통",
    tags: ["정책모니터링", "Python", "정규표현식"],
    content:
      "6건 본문에 등장하는 정부전화 패턴(0X-NNN-NNNN 또는 0XX-NNN-NNNN 형식) 총 등장 횟수는?",
    submission_slots: [
      { id: "answer", type: "number", label: "정수 답", max_score: 20 },
    ],
    max_score: 20,
    set_id: set1.id,
    set_order: 5,
  },
  {
    code: "BLUE-S1-M1-Q6",
    category_id: CAT_CONTENT,
    grade_id: BLUE,
    difficulty: "보통",
    tags: ["정책모니터링", "제출파일", "CSV"],
    content:
      "담당 부서별 자료 수·공무원 횟수 합·평균 본문 줄 수를 정리한 CSV 파일을 제출하세요.\n- 컬럼 4개: 담당부서, 자료수, 공무원횟수합, 평균줄수\n- 정렬: 자료수 내림차순\n- 인코딩: UTF-8",
    submission_slots: [
      {
        id: "csv",
        type: "file",
        label: "부서별_자료수.csv",
        max_score: 10,
        accept: ".csv",
      },
    ],
    max_score: 10,
    set_id: set1.id,
    set_order: 6,
  },

  // Set 2 · 2과목 데이터분석
  {
    code: "BLUE-S1-M2-Q1",
    category_id: CAT_DATA,
    grade_id: BLUE,
    difficulty: "쉬움",
    tags: ["데이터분석", "pandas", "merge"],
    content: "두 파일을 병합할 때 기준이 되는 공통 컬럼의 이름은?",
    submission_slots: [
      { id: "answer", type: "text", label: "컬럼명 (한글/영문 정확히)", max_score: 5 },
    ],
    max_score: 5,
    set_id: set2.id,
    set_order: 1,
  },
  {
    code: "BLUE-S1-M2-Q2",
    category_id: CAT_DATA,
    grade_id: BLUE,
    difficulty: "보통",
    tags: ["데이터분석", "pandas", "groupby"],
    content:
      "전처리 완료 데이터에서 사업유형별 평균 집행률이 가장 높은 사업유형의 이름은?",
    submission_slots: [
      { id: "answer", type: "text", label: "사업유형명 (한글 정확히)", max_score: 20 },
    ],
    max_score: 20,
    set_id: set2.id,
    set_order: 2,
  },
  {
    code: "BLUE-S1-M2-Q3",
    category_id: CAT_DATA,
    grade_id: BLUE,
    difficulty: "보통",
    tags: ["데이터분석", "전처리", "이상치"],
    content:
      "조건 기반 결측치 처리 + Z-score(|z|>3) 이상치 제거 후 남은 데이터의 행 수는?",
    submission_slots: [
      { id: "answer", type: "number", label: "정수 (행 수)", max_score: 20 },
    ],
    max_score: 20,
    set_id: set2.id,
    set_order: 3,
  },
  {
    code: "BLUE-S1-M2-Q4",
    category_id: CAT_DATA,
    grade_id: BLUE,
    difficulty: "어려움",
    tags: ["데이터분석", "라벨링"],
    content:
      "정제된 데이터에서 라벨이 1(목표달성)인 사업의 예산_억원 평균을 반올림한 정수는? (단위: 억원)",
    submission_slots: [
      { id: "answer", type: "number", label: "정수 (억원)", max_score: 22 },
    ],
    max_score: 22,
    set_id: set2.id,
    set_order: 4,
  },
  {
    code: "BLUE-S1-M2-Q5",
    category_id: CAT_DATA,
    grade_id: BLUE,
    difficulty: "어려움",
    tags: ["데이터분석", "sklearn", "train_test_split"],
    content:
      "정제된 데이터에 학습/테스트 분할(test_size=0.2, random_state=42, stratify=라벨)을 적용한 뒤, 테스트셋에서 라벨이 1인 행의 수는?",
    submission_slots: [
      { id: "answer", type: "number", label: "정수 (행 수)", max_score: 23 },
    ],
    max_score: 23,
    set_id: set2.id,
    set_order: 5,
  },
  {
    code: "BLUE-S1-M2-Q6",
    category_id: CAT_DATA,
    grade_id: BLUE,
    difficulty: "어려움",
    tags: ["데이터분석", "제출파일", "보고서"],
    content:
      "Python 분석 결과를 분석 보고서로 작성하여 제출하세요.\n\n필수 차트 5종:\n1) 사업유형별 평균 집행률 (bar)\n2) 예산_억원 분포 histogram (Z-score 이상치 제거 전)\n3) KPI달성률 vs 만족도 scatter\n4) 4개 회귀모델 R² 비교 bar\n5) DecisionTreeRegressor max_depth별 R² line\n\n분석 내용: 데이터 개요 · 전처리 과정 · EDA · 회귀 모델 성능 비교 · 결론",
    submission_slots: [
      {
        id: "report",
        type: "file",
        label: "분석_보고서.docx 또는 분석_보고서.hwpx",
        max_score: 10,
        accept: ".docx,.hwpx",
      },
    ],
    max_score: 10,
    set_id: set2.id,
    set_order: 6,
  },

  // Set 3 · 3과목 자동화
  {
    code: "BLUE-S1-M3-Q1",
    category_id: CAT_SERVICE,
    grade_id: BLUE,
    difficulty: "어려움",
    tags: ["자동화", "웹배포", "정적페이지"],
    content:
      "지역균형발전 사업 카드 검색·필터링 정적 웹 페이지를 만들어 무료 호스팅(Vercel · Netlify · GitHub Pages 등)에 배포하고 URL을 제출하세요.\n\n요구사항:\n- <title>에 '지역균형발전' 또는 '사업검색' 포함\n- 사업 카드 표시 (사업명·지역·사업분야·총사업비)\n- 검색/필터 (사업분야 또는 지역)\n- '결과 N건' 표시\n- 카드뉴스 이미지 1장 이상 표시\n- korea.kr 보도자료 RSS 피드 임베드 · 최신 5건 이상",
    submission_slots: [
      {
        id: "url",
        type: "url",
        label: "배포된 페이지 URL (배포_URL.txt 내용)",
        max_score: 50,
      },
    ],
    max_score: 50,
    set_id: set3.id,
    set_order: 1,
  },
  {
    code: "BLUE-S1-M3-Q2",
    category_id: CAT_SERVICE,
    grade_id: BLUE,
    difficulty: "어려움",
    tags: ["자동화", "Python", "CSV"],
    content:
      "solution.py 한 파일로 첨부 CSV 두 개를 읽어 다음을 콘솔·결과_요약.csv에 출력하는 도구를 작성하세요.\n\n출력 내용:\n- 총 사업 수 (정수)\n- 완료된 사업 수 (정수)\n- 평균 총사업비 (정수 · 억원)\n- 사업분야별 사업 수 (표)\n- 지역별 평균 재정자립도 상위 3 (표)\n\n권장: 표준 라이브러리(csv · json · pathlib)만 사용. 외부 패키지 지양.\n\n제출: solution.py + 결과_요약.csv + 제출물.md (사용 AI 도구 + 구현 메모 3~5줄)",
    submission_slots: [
      {
        id: "script",
        type: "file",
        label: "solution.py (실행 40점)",
        max_score: 40,
        accept: ".py",
      },
      {
        id: "output",
        type: "file",
        label: "결과_요약.csv (참고)",
        max_score: 0,
        accept: ".csv",
      },
      {
        id: "memo",
        type: "file",
        label: "제출물.md (사용 AI + 메모 · 소스 10점)",
        max_score: 10,
        accept: ".md",
      },
    ],
    max_score: 50,
    set_id: set3.id,
    set_order: 2,
  },
];

// insert 문항들
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

// exam_questions 매핑
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

console.log("\n✅ Seed 완료 · 총합:");
console.log(`   - 1 exam`);
console.log(`   - 3 question_sets`);
console.log(`   - ${insertedQuestions.length} questions`);
console.log(`   - 100+100+100 = 300점 (100점 환산 · 합격 60점)`);
console.log(`\n다음: 관리자 페이지 mock → Supabase 실 데이터 전환 · 로그인 후 확인`);
