-- 동일 응시자는 한 시험에서 정확히 하나의 세션만 가질 수 있다.
-- 미제출 세션은 재접속에 재사용하고, 제출 완료 세션은 재응시를 차단한다.
create unique index if not exists idx_exam_sessions_invitation_unique
  on exam_sessions (invitation_id)
  where invitation_id is not null;

comment on index idx_exam_sessions_invitation_unique is
  '명단 초대 1건당 시험 세션 1개 보장 · 동시 진입 중복 생성 방지';
