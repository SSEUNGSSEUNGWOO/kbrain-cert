# 원본 사이트 기능 카탈로그 & 이식 결정

**원본**: `C:\Dev\kbrain\AI Champion Certification System` (Vite + React + TS + Supabase, Lovable 제작)
**목적**: 원본의 어떤 기능을 새 프로젝트(kbrain-cert)로 가져올지 승우님이 취사선택.

## 표기법

| 마크 | 의미 |
|---|---|
| ✅ | 가져올 예정 (M1~M4 스코프에 포함) |
| 🔧 | 아이디어만 가져오고 새로 설계 (원본 코드는 참고만) |
| 🕒 | 확장(M5 이후) 후보 — MVP는 제외 |
| ❌ | 제외 (원본만의 사정, 새 프로젝트에 불필요) |
| ❓ | **승우님 결정 필요** |

각 항목 좌측에 마크. 승우님이 리뷰하면서 마크만 바꿔주시면 스코프 확정.

---

## 1. 페이지 (총 21개)

### 인증
| 마크 | 페이지 | 원본 파일 | 비고 |
|---|---|---|---|
| ✅ | `/login` | `src/pages/LoginPage.tsx` | 이메일/패스워드 + Google OAuth (Supabase Auth) |
| ❓ | 초대코드 OTP 인증 | `src/pages/LoginPage.tsx` + `send-guest-otp` | **결정 필요** — 초대전용 시험 지원 여부. 지원하면 이메일 OTP 인프라 필요 |
| ✅ | `/auth/callback` | `src/pages/AuthCallback.tsx` | OAuth 콜백 처리 |
| ✅ | `/reset-password` | `src/pages/ResetPasswordPage.tsx` | 표준 |

### 관리자 (8개)
| 마크 | 페이지 | 원본 파일 | 비고 |
|---|---|---|---|
| ✅ | `/admin/exams` (시험 관리) | `ExamManagePage.tsx` | 시험 CRUD, 문제 할당, 초대 관리 |
| ✅ | `/admin/questions` (문제은행) | `QuestionBankPage.tsx` | CRUD, 세트 관리, 대량 업로드 |
| ✅ | `/admin/grading` (채점) | `GradingPage.tsx` | 100점 환산 통일(이슈 #3) |
| ✅ | `/admin/users` (사용자 관리) | `UserManagePage.tsx` | 역할 관리 |
| ✅ | `/admin/stats` (통계) | `StatsPage.tsx` | 등급별 합격률, 월별 추이 |
| 🕒 | `/admin/certifications` (인증서) | `CertificationsPage.tsx` | 발급 인증서 DB, 취소 처리 — MVP엔 불필요? |
| ❓ | `/admin/recordings` (녹화 검토) | `RecordingReviewPage.tsx` | **녹화 기능 도입 여부에 종속** |
| ❌ | `/admin/facepp-test` | `FaceppTestPage.tsx` | Face++ 테스트 — 원본에서도 개발용, 제외 |
| ❓ | `/admin/settings` (사이트 설정) | `SettingsPage.tsx` | 브랜딩·이메일 헤더 등 — MVP에 얼마나 필요? |

### 응시자 (5개)
| 마크 | 페이지 | 원본 파일 | 비고 |
|---|---|---|---|
| ✅ | `/applicant` (대시보드) | `ApplicantMyPage.tsx` | 응시 가능 시험, 결과 목록 |
| ✅ | `/applicant/waiting-room/:id` (대기실) | `WaitingRoom.tsx` | 환경 체크, 서약, 입실 |
| ✅ | `/applicant/exam/:id` (응시) | `ExamPage.tsx` | 타이머·감독·문제 렌더 |
| ✅ | `/applicant/submitted/:id` (제출 완료) | `SubmittedPage.tsx` | |
| ✅ | `/applicant/results/:id` (결과) | `ResultsPage.tsx` | 100점 환산 표시(이슈 #3) |

### 감독관 (2개)
| 마크 | 페이지 | 원본 파일 | 비고 |
|---|---|---|---|
| ✅ | `/examiner/monitor` (모니터링) | `MonitorDashboard.tsx` | 실시간 감독 대시보드 |
| ✅ | `/examiner/events` (이벤트 로그) | `EventLogPage.tsx` | 감독 이벤트 조회 |

---

## 2. 문제 유형 지원 여부

**결정 I (2026-07-14)**: 승우님 CBT는 **모든 문항이 작업형(슬롯형)** — 다른 유형은 사용 안 함.

| 마크 | 유형 | 자동채점 | 원본 로직 |
|---|---|---|---|
| ❌ | 객관식 (multiple_choice) | — | 스코프 제외 (결정 I) |
| ❌ | 단답형 (short_answer) | — | 스코프 제외 (결정 I) |
| ❌ | 서술형 (essay) | — | 스코프 제외 (결정 I) |
| ❌ | 실기형 (file_upload) | — | 스코프 제외 (결정 I) — 작업형 슬롯의 `file` 타입으로 흡수 가능 |
| ✅ | **작업형 (work_based, 슬롯형)** — **유일한 유형** | 없음 (전부 수동) | `submission_slots[]` — text/long_text/url/file/number 조합 |
| ✅ | 시나리오형 세트 (question_set) | — | 세트 안에 작업형 문항 여러 개, `set_order` |

---

## 3. 감독(Proctoring) 기능

| 마크 | 기능 | 원본 라이브러리 | 부하 |
|---|---|---|---|
| ✅ | 얼굴 감지 (미검출/다인원) | face-api.js v0.22.2 (TinyFaceDetector) | 브라우저 로컬 (2.5s 간격) |
| ✅ | 음성 감지 | Web Audio API (RMS) | 브라우저 로컬 |
| ✅ | 전체화면 이탈 | Fullscreen API | 이벤트 리스너 |
| ✅ | 탭 전환 감지 | Page Visibility API | 이벤트 리스너 |
| ✅ | 서약(부정행위 금지) | `SecurityPledge.tsx` | 텍스트 |
| ❌ | 화면 캡처 방지 워터마크 | `AntiOcrWatermark.tsx` | 승우님 결정: 시각 노이즈만 큼 · 제외 |
| ❓ | **웹캠/화면 녹화** | Daily.co + Cloudflare R2 | **인프라 큰 결정 (아래 §5)** |
| ❓ | **신분증 검증** | AWS Rekognition (ap-northeast-2) | **비용/규정 결정 (아래 §5)** |
| ❓ | 화상회의 (감독관 실시간 관찰) | Daily.co | **감독관이 응시자 실시간 화면 보고 싶은지 여부** |
| 🕒 | 듀얼 모니터 감지 | `DualMonitorDetector.tsx` | screen API |
| ❓ | 응시자↔감독관 실시간 채팅 | Daily chat API | Daily 도입 시 자동 포함 |

---

## 4. 시험/응시자 관리 세부

| 마크 | 기능 | 원본 |
|---|---|---|
| ✅ | 시험 CRUD + 상태(draft/open/closed) | `exams` 테이블 |
| ✅ | 절대시간 모드 / 상대시간 모드 | `use_absolute_end` |
| ✅ | 테스트 모드 (언제든 응시) | `is_test_mode` |
| ✅ | 입실 허용 시간 (분 단위) | `entry_start_minutes` |
| ✅ | 세트별 `proctoring_disabled` (⚠️ 이슈 #1) | **새로 추가할 것** |
| ✅ | 응시자 배정 방식: 공개/초대전용/혼합 | `registration_mode` |
| ❓ | 초대 이메일 발송 | Resend API | 초대전용 도입 시 필수 |
| ✅ | 등급 (green/blue/black/전문인재) | `exam_grade` enum | 승우님 사업 스코프에 따라 커스텀 |
| 🔧 | 카테고리 (생성형AI활용/데이터분석/서비스구현) | `question_category` | 하드코딩 대신 관리자 설정 가능하게? |
| ✅ | 합격 기준 점수 | `pass_score` |
| ✅ | 시험별 커스텀 문구 | `custom_texts` JSONB |
| ✅ | 감독 알림 화이트리스트 | `alert_event_types` |

---

## 5. 외부 서비스 통합 (⚠️ 승우님 큰 결정 5개)

원본은 아래 5개 외부 서비스를 씀. **각각 비용·복잡도·규정 이슈 있음**. 결정에 따라 스코프 크게 달라짐.

### 5.1 Daily.co (화상회의 + 화면공유)
- **원본 용도**: 응시자 웹캠/마이크/화면공유 스트림을 감독관이 실시간 관찰, 응시자↔감독관 채팅
- **비용**: 유료 (분당 과금), 300명 동시면 상당함
- **대안**: 감독관 실시간 관찰 없이 이벤트 로그만 보는 방식(현재 kbrain-cert 계획)
- ❓ **결정**: [ ] 이식 / [ ] 제외 (이벤트 로그 방식으로 대체)

### 5.2 Cloudflare R2 (녹화 저장)
- **원본 용도**: 응시 중 웹캠+화면 녹화 500ms 청크를 R2에 업로드, 사후 검토
- **비용**: R2 저장 비용 + Presigned URL Edge Function
- **복잡도**: WebAssembly MediaRecorder + AWS SigV4 서명 구현, 실패 재시도, 청크 병합 재생
- **대안**: 녹화 없이 이벤트 로그·스크린샷만
- ❓ **결정**: [ ] 이식(전면) / [ ] 스크린샷만(경량) / [ ] 제외

### 5.3 AWS Rekognition (신분증 검증)
- **원본 용도**: 응시 전 신분증 사진 + 셀카 비교로 본인 인증 (CompareFaces API)
- **비용**: 요청당 과금, 300명이면 관리 가능한 수준
- **규정**: 신분증 이미지가 AWS로 전송됨 → 개인정보 처리방침 필요
- **대안**: 신분증 없이 관리자 사전 승인 / 이메일 OTP만
- ❓ **결정**: [ ] 이식 / [ ] 제외

### 5.4 Lovable AI (Gemini, 시험 유의사항 정리 + 서술형 채점)
- **원본 용도**: `polish-instructions`(유의사항 정리), `ai-grade`(서술형 AI 채점)
- **kbrain-cert 대안**: OpenAI 사용 (승우님 이미 키 보유, `project_doc_audit.md`)
- 🔧 **거의 확정**: 아이디어(AI 채점)는 가져오되 **OpenAI로 재작성**

### 5.5 Resend (이메일 발송)
- **원본 용도**: 초대코드 이메일, OTP 이메일
- **kbrain-cert 대안**: Resend 그대로 or Supabase Auth 내장 이메일
- ❓ **결정**: [ ] Resend / [ ] Supabase Auth 내장 / [ ] 결정 보류

---

## 6. Edge Functions (18개)

| 마크 | 함수 | 역할 | 이식 방식 |
|---|---|---|---|
| ❓ | `send-guest-otp` / `verify-guest-otp` | 초대코드 OTP 이메일 | 초대전용 지원 시 |
| 🔧 | `ai-grade` | 서술형 AI 채점 (Lovable→OpenAI로 교체) | Next.js Server Action or Supabase Function |
| 🔧 | `polish-instructions` | 시험 유의사항 AI 정리 | 위와 동일 |
| ❓ | `daily-room` | Daily.co 방 생성/토큰 | Daily.co 도입 시 |
| ❓ | `r2-presign` / `r2-upload` / `r2-playback` | 녹화 R2 업로드/재생 | 녹화 도입 시 |
| ❓ | `verify-identity` | AWS Rekognition | 신분증 검증 도입 시 |
| ❓ | `send-exam-invitation` | 초대 이메일 발송 (Resend) | 초대전용 도입 시 |
| ✅ | `delete-user` | 사용자 삭제 | 표준 관리 기능 |
| ❌ | `send-otp` / `verify-otp` | 일반 OTP (원본에서도 미사용) | 스킵 |
| ❌ | `facepp-compare-test` / `zoom-*` | 개발용/미사용 | 스킵 |

---

## 7. DB 스키마 (16 테이블)

| 마크 | 테이블 | 이식 여부 | 변경점 |
|---|---|---|---|
| ✅ | `user_roles` | 이식 | 그대로 |
| ✅ | `exams` | 이식 | `alert_event_types`, `use_absolute_end`, `entry_start_minutes` 등 대부분 유지 |
| ✅ | `questions` | 이식 | ⚠️ 정답/rubric은 서버 전용 뷰(`questions_for_applicant`)로 격리 (이슈 #2) |
| ✅ | `question_sets` | 이식 | ⚠️ `proctoring_disabled boolean` 추가 (이슈 #1) |
| ✅ | `exam_questions` | 이식 | 그대로 |
| ✅ | `exam_sessions` | 이식 | `attempts`로 이름 변경 검토 |
| ✅ | `answers` | 이식 | `slot_values`/`slot_scores` JSONB 유지 |
| ✅ | `monitoring_events` | 이식 | 파티셔닝 추가 (300명 대응) |
| 🕒 | `certifications` | M5 이후 | 인증서 발급 별도 결정 |
| ❓ | `exam_invitations` | 초대전용 결정에 종속 | |
| ❓ | `sms_otp_codes` | OTP 도입 시 | |
| ✅ | `profiles` | 이식 | 표준 |
| ❓ | `recording_chunks` | 녹화 결정에 종속 | |
| ✅ | `site_settings` | 이식 | 브랜딩·이메일 헤더 |
| 🔧 | `grading_jobs` | 재설계 | AI 채점 큐 — 새로 설계 |

---

## 8. UI 부가 기능

| 마크 | 기능 | 원본 |
|---|---|---|
| ✅ | Markdown 문제 렌더링 (remark-gfm) | `MarkdownView.tsx` |
| ✅ | 문제 미리보기 (관리자/응시자 관점) | `SingleQuestionPreviewDialog`, `ApplicantPreviewDialog` |
| ✅ | 문제 변경 이력 로그 | `QuestionLogViewer.tsx` |
| ✅ | 태그 검색/필터 | `TagControls.tsx` |
| ✅ | 문제 CSV/JSON 대량 업로드 | `QuestionSetUploadDialog.tsx` |
| ✅ | 크로스테이블 (응시자 × 문항 점수 매트릭스) + CSV/xlsx export | `CrossTableDialog.tsx` |
| 🕒 | AI로 시험 유의사항 자동 정리 | `polish-instructions` |
| ❌ | ASCII 배경 애니메이션 | `AsciiMorphBackground.tsx` — 원본 취향, 제외 |

---

## 9. 결정 요약 시트 (승우님이 마킹만 해주시면 됨)

### 큰 방향 결정 (5개)

| # | 결정 항목 | 옵션 | 승우님 선택 |
|---|---|---|---|
| A | 감독관 실시간 관찰 (화상회의) | (1) Daily.co 이식 / (2) 이벤트 로그만 (권장, 300명 부하·비용 절감) | ___ |
| B | 응시 녹화 | (1) R2 전면 녹화 / (2) 이벤트 시점 스크린샷만 / (3) 없음 (권장) | ___ |
| C | 신분증 검증 | (1) AWS Rekognition 이식 / (2) 없음 (관리자 사전승인) | ___ |
| D | 초대전용 응시자 (OTP) | (1) 이식 (Resend/Supabase Auth) / (2) 오픈 등록만 | ___ |
| E | AI 서술형 채점 | (1) OpenAI로 재작성 (권장, 승우님 키 보유) / (2) 수동만 | ___ |

### 부가 결정 (3개)

| # | 결정 항목 | 옵션 | 승우님 선택 |
|---|---|---|---|
| F | 인증서 발급 | (1) MVP 포함 / (2) M5 이후 (권장) | ___ |
| G | 카테고리 (생성형AI/데이터분석/서비스구현) | (1) 원본 하드코딩 이식 / (2) 관리자 설정 가능하게 | ___ |
| H | 등급 (green/blue/black/전문인재) | (1) 그대로 이식 / (2) 승우님 사업 스코프에 맞게 재정의 | ___ |

---

## 10. 다음 단계

승우님이 A~H 마킹 → 그 결정을 `FEATURES.md`와 `MASTER_PLAN.md` M1~M5 마일스톤에 반영 → 스코프 확정 → M1 스캐폴딩 진입.
