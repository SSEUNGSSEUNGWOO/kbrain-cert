-- 테스트 링크 · 응시자가 시험 전에 여러 번 접속해 첨부·문항 미리 확인
-- - 인증 없이 접근 (slug만 있으면 통과)
-- - 답안 저장 X · 감독 이벤트 X
-- - 응시자 URL 공유해도 안전 (실 답 저장 안 되므로)

alter table exams
  add column if not exists practice_slug text;

create unique index if not exists idx_exams_practice_slug
  on exams (practice_slug)
  where practice_slug is not null;

comment on column exams.practice_slug is
  '테스트 링크 slug · null이면 미발급. /practice/{slug} URL. 여러 번 접속 가능';
