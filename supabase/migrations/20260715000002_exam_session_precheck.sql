-- Precheck 결과 저장을 위한 exam_sessions 확장
-- A-a-i 정책: 실 시험만 저장 · 스텝별 upsert · 마지막 스냅샷 (덮어쓰기)
-- Practice(익명)는 저장하지 않음 (sessionId 없음)

alter table exam_sessions
  add column if not exists precheck_env_result jsonb,
  add column if not exists precheck_pledge_accepted_at timestamptz,
  add column if not exists precheck_waiting_entered_at timestamptz,
  add column if not exists precheck_user_agent text;

-- start_time은 기존 컬럼 재사용 (exam_entered_at 역할)

comment on column exam_sessions.precheck_env_result is
  '환경 체크 6개 항목 결과 스냅샷: { monitor, webcam, screen, network, cpu, browser } · 각 항목은 { status, detail, metric? }';
comment on column exam_sessions.precheck_pledge_accepted_at is
  '보안 서약 7개 항목 모두 동의 완료 시각';
comment on column exam_sessions.precheck_waiting_entered_at is
  '대기실 진입 시각 (환경 체크 + 서약 완료 후)';
comment on column exam_sessions.precheck_user_agent is
  '응시자 브라우저 UA · 사후 검토용';
