# kbrain-cert — 결정 사항 확정

**최종 갱신**: 2026-07-14
**목적**: `INVENTORY.md` 검토 후 승우님이 확정한 이식 방향. `FEATURES.md`·`MASTER_PLAN.md`·`ARCHITECTURE.md`는 모두 이 결정을 기반으로 작성됨.

---

## 원본 스코프 대부분 이식 (공식 자격증급 수준)

승우님 목표: **kbrain-cert = 공식 자격증 발급 가능한 수준의 CBT**. 원본(AI Champion) 기능 대부분을 이식하되, 원본 plan의 4개 이슈(감독 유연성·정답 격리·점수 통일·타이머)는 근본 개선.

---

## 큰 방향 결정 8개 (확정)

| # | 항목 | 결정 | 파급 |
|---|---|---|---|
| **A** | 감독관 실시간 화상 관찰 | **✅ 이식 (Daily.co)** | 감독관이 응시자 웹캠·화면공유를 실시간 관찰. 감독 대시보드에 그리드 뷰 + 개별 상세. Daily Prime 구독 예상 |
| **B** | 응시 녹화 | **✅ 이식 (Cloudflare R2 전면 녹화)** | 웹캠·화면 청크 500ms 단위 R2 업로드. 사후 재생·검토 가능. WebAssembly MediaRecorder + AWS SigV4 서명 |
| **C** | 본인 인증(신분증) | **🔧 업로드만** | AWS Rekognition은 **제외**. 응시자가 신분증 사진 업로드 → **관리자 사후 검토** (개인정보 처리방침 부담 감소) |
| **D** | 응시자 등록 방식 | **✅ 초대전용 메인** | 관리자가 명단 업로드 → 초대코드·상시링크 이메일 발송 → 이메일 OTP로 응시자 진입. **오픈 등록은 M6 이후로** |
| **E** | 서술형 AI 채점 | **❌ 없음** | 자동채점(객관식·단답)만 유지. 서술형은 **답안 CSV/JSON export** 기능으로 대체 → 관리자가 외부 CLI/사람에게 위임 |
| **F** | 인증서 발급 | **❌ 제외** | `certifications` 테이블·`/admin/certifications` 페이지 모두 제거. "시험만 보면 됨" 수준 |
| **G** | 카테고리 하드코딩(생성형AI/데이터분석/서비스구현) | **✅ 관리자 설정으로 해제** | `question_categories` 테이블 신설 |
| **H** | 등급 하드코딩(green/blue/black/전문인재) | **✅ 관리자 설정으로 해제** | `exam_grades` 테이블 신설. `exam_grade` enum 제거 |

---

## 이식 매핑 상세

### ✅ 이식 (원본 그대로 or 마이너 수정)

- 페이지 21개 중 18개 (인증서·Face++ 테스트·`send-otp/verify-otp` 제외)
- 문제 유형 5종 (객관식·단답·서술형·실기·작업형/슬롯형) + 시나리오형 세트
- 감독 로컬 컴포넌트 (`FaceMonitor` · `VoiceMonitor` · `FullscreenGuard` · `SecurityPledge` · `AntiOcrWatermark`)
- Daily.co 통합 (`DailyProctor`, `ExamChatPanel`, `DailyMonitorGrid`, `daily-room` Edge Function)
- R2 녹화 (`RecordingStatusBadge`, `RecordingReviewPage`, `r2-*` Edge Functions)
- 초대전용 OTP (`send-guest-otp` · `verify-guest-otp` · `send-exam-invitation` · `exam_invitations` 테이블)
- 크로스테이블 CSV export (`CrossTableDialog`)
- 통계 대시보드 (`StatsPage`)
- 시험 관리 (절대시간·상대시간·테스트 모드·`entry_start_minutes`·`custom_texts`·`alert_event_types`)

### 🔧 아이디어만 가져와 새로 설계

- **본인 인증**: `verify-identity` Edge Function 제외 → `applicant_documents` 테이블에 신분증 이미지 저장 + 관리자 사후 확인 UI
- **AI 유의사항 정리** (`polish-instructions`): OpenAI로 재작성 검토 → M6 이후
- **카테고리·등급 관리**: 원본 enum 제거 → `question_categories`, `exam_grades` 테이블
- **답안 export**: 원본에 없음 → 신규 기능. 세션·응시자·문제 기준 CSV/JSON export (서술형 채점용)

### 🕒 확장 (M6 이후)

- 오픈 등록 모드
- 듀얼 모니터 감지
- 관리자 감사 로그
- 크로스 채점 (2인 채점 편차 검토)

### ❌ 제외

- 인증서 발급 (`certifications` 테이블 · 페이지 · 발급 로직 전부)
- AWS Rekognition (`verify-identity` Edge Function)
- 서술형 AI 채점 (`ai-grade` Edge Function · Lovable Gemini)
- Face++ 테스트 페이지, Zoom SDK (원본에서도 미사용), 개발용 테스트 페이지들

---

## 감수한 리스크 (승우님 확인 완료)

| 리스크 | 대응 방안 |
|---|---|
| **Daily.co 300명 동시 구독료** | Daily Prime 플랜 필요. 정확한 비용은 M1 진입 시 Daily 견적으로 확인 |
| **R2 저장 비용 (시험당 100~300GB)** | 보관 정책 정해야 함 — 기본 30일 후 자동 삭제 or 저사양 저장 archive |
| **브라우저 부하** (WebRTC + MediaRecorder + face-api + WebAudio 동시) | 대기실 사전 체크에 CPU 벤치마크 추가, 최소 사양 명시. 저사양 응시자는 관리자 승인 예외 |
| **실기기 부하 테스트 불가** (Playwright는 WebRTC 미지원) | M6에 실제 다중 노트북 리허설 필수 |

---

## 미해결 (M1 진입 전 최종 확정 필요)

1. **Daily.co 구독 플랜 결정** — 견적 요청 필요
2. **R2 계정** — Cloudflare 계정 및 R2 버킷 생성 (승우님 or daeasy 명의)
3. **Resend vs Supabase Auth 이메일** — 초대 이메일 발송 채널 (Resend가 원본 방식, 브랜드 통일성 유리)
4. **얼굴 감지 모델** — face-api.js 유지 vs MediaPipe (성능/정확도 개선 여지)
5. **응시 녹화 보관 기간** — 30일? 6개월? 1년? (R2 비용에 직결)
