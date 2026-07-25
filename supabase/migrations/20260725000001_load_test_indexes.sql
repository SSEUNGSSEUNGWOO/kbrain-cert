-- 100명 동시 응시 대비 인덱스 보강
-- - exam_sessions (invitation_id): 응시자 진입 시 세션 존재 확인 (기존: full scan)
-- - answers (session_id, question_id): 답안 upsert conflict lookup (기존: session_id만)

create index if not exists idx_exam_sessions_invitation_active
  on exam_sessions (invitation_id)
  where submit_time is null;

create index if not exists idx_answers_session_question
  on answers (session_id, question_id);

-- 확인: select indexname, indexdef from pg_indexes where tablename in ('exam_sessions', 'answers');
