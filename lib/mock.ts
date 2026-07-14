/**
 * Mock 데이터 — 프로토타입 3개 페이지 공용
 * 실제 Supabase 연동은 M2 이후.
 */

export type QuestionType =
  | "multiple_choice"
  | "short_answer"
  | "essay"
  | "work_based";

export type Question = {
  id: string;
  index: number;
  type: QuestionType;
  content: string;
  maxScore: number;
  options?: Array<{ id: string; text: string }>;
  slots?: Array<{
    id: string;
    label: string;
    type: "text" | "long_text" | "url" | "file" | "number";
    maxScore: number;
  }>;
  setId?: string;
  policy?: string;
};

export type QuestionSet = {
  id: string;
  title: string;
  scenario?: string;
  proctoringDisabled: boolean;
  questionIds: string[];
};

export type Exam = {
  id: string;
  title: string;
  grade: string;
  gradeColor: string;
  category: string;
  durationMinutes: number;
  totalScore: number;
  passingScore: number;
};

export type Applicant = {
  id: string;
  name: string;
  email: string;
  organization: string;
};

export type ProctoringEvent = {
  id: string;
  sessionId: string;
  applicantName: string;
  type:
    | "face_missing"
    | "multiple_faces"
    | "voice_detected"
    | "fullscreen_exit"
    | "tab_switch"
    | "recording_error";
  severity: "info" | "warn" | "high";
  occurredAt: string; // relative like "38초 전"
  questionIndex: number;
  note?: string;
};

export type MonitorApplicant = {
  sessionId: string;
  applicant: Applicant;
  progress: number; // 0-100
  currentQuestion: number;
  warningCount: number;
  lastEvent?: {
    type: ProctoringEvent["type"];
    severity: ProctoringEvent["severity"];
    label: string;
  };
  streaming: "healthy" | "warning" | "disconnected";
  recording: "recording" | "paused" | "error";
};

/* ─────────── 시험 ─────────── */

export const mockExam: Exam = {
  id: "exam-2026-07-15",
  title: "2026년 하반기 AI 챔피언 자격 검정",
  grade: "블랙 (Black)",
  gradeColor: "hsl(222 47% 11%)",
  category: "생성형AI 활용",
  durationMinutes: 90,
  totalScore: 300,
  passingScore: 75, // 100점 환산
};

/* ─────────── 문제 세트 & 문제 ─────────── */

export const mockSets: QuestionSet[] = [
  {
    id: "set-1",
    title: "1부 · 이론 (감독 활성)",
    proctoringDisabled: false,
    questionIds: ["q1", "q2", "q3"],
  },
  {
    id: "set-2",
    title: "2부 · 실무 사례 (감독 활성)",
    scenario: "다음 상황을 읽고 답하시오.",
    proctoringDisabled: false,
    questionIds: ["q4"],
  },
  {
    id: "set-3",
    title: "3부 · 생성형AI 작업형 (외부 도구 허용 · 감독 비활성)",
    scenario: "제공된 데이터셋을 활용해 결과물을 제출하시오.",
    proctoringDisabled: true,
    questionIds: ["q5"],
  },
];

export const mockQuestions: Question[] = [
  {
    id: "q1",
    index: 1,
    type: "multiple_choice",
    content:
      "다음 중 대규모 언어 모델의 파라미터 효율적 미세조정(PEFT) 기법이 **아닌** 것은?",
    maxScore: 10,
    options: [
      { id: "a", text: "LoRA (Low-Rank Adaptation)" },
      { id: "b", text: "Prefix Tuning" },
      { id: "c", text: "Full Fine-tuning" },
      { id: "d", text: "Adapter Tuning" },
    ],
    setId: "set-1",
  },
  {
    id: "q2",
    index: 2,
    type: "short_answer",
    content: "Transformer 아키텍처에서 self-attention의 시간 복잡도를 시퀀스 길이 n에 대해 표기하시오.",
    maxScore: 10,
    setId: "set-1",
  },
  {
    id: "q3",
    index: 3,
    type: "essay",
    content:
      "RAG(Retrieval-Augmented Generation) 시스템에서 검색 품질을 개선하기 위한 3가지 전략을 근거와 함께 서술하시오. (200~300자)",
    maxScore: 30,
    setId: "set-1",
  },
  {
    id: "q4",
    index: 4,
    type: "essay",
    content:
      "**[사례]** 이커머스 사이트에서 상품 검색 정확도를 높이기 위해 임베딩 기반 검색을 도입하려 한다. 도입 전후 A/B 테스트 설계 방법을 서술하시오.",
    maxScore: 50,
    setId: "set-2",
  },
  {
    id: "q5",
    index: 5,
    type: "work_based",
    content:
      "제공된 고객 문의 데이터 200건을 분석하여 상위 카테고리 5개로 자동 분류하는 프롬프트 또는 파이프라인을 설계하고, 실행 결과를 첨부하시오. **외부 LLM 도구 사용을 허용합니다.**",
    maxScore: 100,
    slots: [
      { id: "prompt", label: "설계한 프롬프트/코드", type: "long_text", maxScore: 40 },
      { id: "result_file", label: "실행 결과 파일", type: "file", maxScore: 30 },
      { id: "explanation", label: "설계 근거 설명", type: "long_text", maxScore: 30 },
    ],
    setId: "set-3",
    policy: "외부 도구 사용 허용 · 감독 일시 비활성",
  },
];

/* ─────────── 응시 세션 (본인) ─────────── */

export const mockSession = {
  id: "session-ohjieun",
  applicantName: "오지은",
  organization: "daeasy",
  startTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  remainingSeconds: 78 * 60,
  currentQuestionIndex: 2, // q3
  answers: {
    q1: { selected: "a" },
    q2: { text: "O(n²)" },
    q3: { text: "" },
    q4: { text: "" },
    q5: {},
  } as Record<string, unknown>,
  proctoring: {
    face: "ok" as "ok" | "missing" | "multiple",
    voice: "ok" as "ok" | "detected",
    fullscreen: "ok" as "ok" | "exited",
    recording: "recording" as "recording" | "paused" | "error",
  },
};

/* ─────────── 감독관 대시보드 데이터 ─────────── */

const koreanNames = [
  "김민준", "이서연", "박지훈", "최수아", "정예린",
  "강도윤", "조하은", "윤시우", "장유나", "임재원",
  "한서준", "오지호", "신아린", "권민서", "황건우",
  "안수빈", "송우진", "홍채원", "유하준", "노소율",
  "배주원", "문지우", "손예준", "양채린", "고승우",
  "허유찬", "남지안", "심도현", "곽수민", "지현우",
];

const orgs = ["서울대", "KAIST", "포스텍", "고려대", "daeasy", "네이버", "카카오", "당근마켓"];

export const mockMonitorApplicants: MonitorApplicant[] = koreanNames.map((name, i) => {
  const progress = 20 + Math.floor(Math.random() * 70);
  const warningCount = Math.random() < 0.6 ? 0 : Math.floor(Math.random() * 4);
  const hasEvent = warningCount > 0;
  const eventTypes: Array<ProctoringEvent["type"]> = [
    "face_missing",
    "voice_detected",
    "fullscreen_exit",
    "multiple_faces",
    "tab_switch",
  ];
  const eventLabels: Record<ProctoringEvent["type"], string> = {
    face_missing: "얼굴 미검출 7.5초",
    multiple_faces: "복수 인원 감지",
    voice_detected: "음성 감지",
    fullscreen_exit: "전체화면 이탈",
    tab_switch: "탭 전환",
    recording_error: "녹화 오류",
  };
  const evType = eventTypes[i % eventTypes.length];
  const severities: ProctoringEvent["severity"][] = ["info", "warn", "high"];
  const streamingRoll = Math.random();
  const streaming: MonitorApplicant["streaming"] =
    streamingRoll < 0.85 ? "healthy" : streamingRoll < 0.95 ? "warning" : "disconnected";
  return {
    sessionId: `sess-${i.toString().padStart(3, "0")}`,
    applicant: {
      id: `app-${i}`,
      name,
      email: `applicant${i}@example.com`,
      organization: orgs[i % orgs.length],
    },
    progress,
    currentQuestion: Math.max(1, Math.floor((progress / 100) * 5)),
    warningCount,
    lastEvent: hasEvent
      ? {
          type: evType,
          severity: warningCount >= 3 ? "high" : warningCount >= 2 ? "warn" : severities[i % 3],
          label: eventLabels[evType],
        }
      : undefined,
    streaming,
    recording: streaming === "disconnected" ? "error" : "recording",
  };
});

export const mockRecentEvents: ProctoringEvent[] = [
  {
    id: "e-1",
    sessionId: "sess-004",
    applicantName: "정예린",
    type: "multiple_faces",
    severity: "high",
    occurredAt: "12초 전",
    questionIndex: 3,
  },
  {
    id: "e-2",
    sessionId: "sess-011",
    applicantName: "한서준",
    type: "fullscreen_exit",
    severity: "high",
    occurredAt: "38초 전",
    questionIndex: 2,
  },
  {
    id: "e-3",
    sessionId: "sess-018",
    applicantName: "유하준",
    type: "voice_detected",
    severity: "warn",
    occurredAt: "1분 12초 전",
    questionIndex: 4,
  },
  {
    id: "e-4",
    sessionId: "sess-003",
    applicantName: "최수아",
    type: "face_missing",
    severity: "warn",
    occurredAt: "1분 44초 전",
    questionIndex: 3,
  },
  {
    id: "e-5",
    sessionId: "sess-014",
    applicantName: "권민서",
    type: "tab_switch",
    severity: "high",
    occurredAt: "2분 05초 전",
    questionIndex: 3,
  },
  {
    id: "e-6",
    sessionId: "sess-022",
    applicantName: "문지우",
    type: "face_missing",
    severity: "info",
    occurredAt: "2분 37초 전",
    questionIndex: 4,
  },
  {
    id: "e-7",
    sessionId: "sess-008",
    applicantName: "장유나",
    type: "voice_detected",
    severity: "info",
    occurredAt: "3분 09초 전",
    questionIndex: 2,
  },
  {
    id: "e-8",
    sessionId: "sess-001",
    applicantName: "이서연",
    type: "recording_error",
    severity: "high",
    occurredAt: "3분 55초 전",
    questionIndex: 1,
    note: "R2 청크 업로드 실패 · 재시도 중",
  },
];

/* ─────────── 대기실 환경체크 데이터 ─────────── */

/* ─────────── 홈·대시보드용 확장 데이터 ─────────── */

export type ExamCard = {
  id: string;
  title: string;
  category: string;
  categoryTone: "blue" | "purple" | "emerald" | "orange" | "pink" | "teal";
  grade: string;
  gradeTone: "emerald" | "indigo" | "red" | "yellow";
  date: string;
  time: string;
  registered: number;
  capacity: number;
  status: "upcoming" | "live" | "closed";
  progress?: number;
};

export const mockExamCards: ExamCard[] = [
  {
    id: "exam-1",
    title: "2026 하반기 AI 챔피언 자격 검정",
    category: "생성형AI 활용",
    categoryTone: "purple",
    grade: "Black",
    gradeTone: "red",
    date: "2026.07.15",
    time: "14:00 ~ 15:30",
    registered: 287,
    capacity: 300,
    status: "live",
    progress: 42,
  },
  {
    id: "exam-2",
    title: "데이터 분석 실무 검정 4기",
    category: "데이터 분석",
    categoryTone: "teal",
    grade: "Blue",
    gradeTone: "indigo",
    date: "2026.07.20",
    time: "10:00 ~ 12:00",
    registered: 156,
    capacity: 200,
    status: "upcoming",
  },
  {
    id: "exam-3",
    title: "서비스 구현 실기 평가",
    category: "서비스 구현",
    categoryTone: "orange",
    grade: "Green",
    gradeTone: "emerald",
    date: "2026.07.22",
    time: "13:00 ~ 15:00",
    registered: 89,
    capacity: 150,
    status: "upcoming",
  },
];

export type ActivityItem = {
  id: string;
  time: string;
  actor: string;
  action: string;
  target: string;
  tone: "blue" | "emerald" | "orange" | "red" | "purple";
};

export const mockRecentActivity: ActivityItem[] = [
  {
    id: "a1",
    time: "방금 전",
    actor: "정예린",
    action: "복수 인원 감지",
    target: "AI 챔피언 자격 · Q3",
    tone: "red",
  },
  {
    id: "a2",
    time: "1분 전",
    actor: "김민준",
    action: "답안 제출",
    target: "AI 챔피언 자격",
    tone: "emerald",
  },
  {
    id: "a3",
    time: "3분 전",
    actor: "이서연",
    action: "응시 시작",
    target: "AI 챔피언 자격",
    tone: "blue",
  },
  {
    id: "a4",
    time: "8분 전",
    actor: "관리자 이명희",
    action: "새 시험 생성",
    target: "데이터 분석 실무 4기",
    tone: "purple",
  },
  {
    id: "a5",
    time: "12분 전",
    actor: "박지훈",
    action: "전체화면 이탈",
    target: "AI 챔피언 자격 · Q2",
    tone: "orange",
  },
];

export const mockAdminStats = {
  totalActive: 287,
  totalSubmitted: 3,
  totalAlerts: mockMonitorApplicants.filter(
    (a) => a.lastEvent?.severity === "high"
  ).length,
  averageProgress: Math.round(
    mockMonitorApplicants.reduce((sum, a) => sum + a.progress, 0) /
      mockMonitorApplicants.length
  ),
};

/* ─────────── 대기실 환경체크 데이터 ─────────── */

export const mockWaitingChecks = [
  {
    id: "webcam",
    label: "웹캠",
    description: "얼굴 인증 · 실시간 감독에 사용됩니다",
    status: "ok" as "ok" | "warn" | "error" | "pending",
    detail: "HD Webcam (720p) 감지",
  },
  {
    id: "mic",
    label: "마이크",
    description: "음성 감지에 사용됩니다",
    status: "ok" as const,
    detail: "기본 마이크 · 볼륨 정상",
  },
  {
    id: "screen",
    label: "화면 공유",
    description: "감독관 실시간 관찰에 필요합니다",
    status: "pending" as "ok" | "warn" | "error" | "pending",
    detail: "권한 요청 대기",
  },
  {
    id: "cpu",
    label: "CPU 성능",
    description: "감독·녹화·화상 동시 실행 부하 측정",
    status: "ok" as const,
    detail: "권장 사양 이상 (score 92 / 100)",
  },
  {
    id: "network",
    label: "네트워크",
    description: "최소 5 Mbps 상행 대역폭 권장",
    status: "warn" as "ok" | "warn" | "error" | "pending",
    detail: "3.8 Mbps · 안정성 주의",
  },
];
