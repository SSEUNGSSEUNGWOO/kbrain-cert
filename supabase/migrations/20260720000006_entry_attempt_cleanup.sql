-- 진입 실패 제한 기록은 하루가 지나면 더 이상 필요하지 않다.

alter table exams
  add column if not exists allow_no_screen_share boolean not null default false;

create extension if not exists pg_cron;

create or replace function cleanup_exam_entry_attempts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from exam_entry_attempts
   where window_started_at < now() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function cleanup_exam_entry_attempts() from public;
grant execute on function cleanup_exam_entry_attempts() to service_role;

select cron.schedule(
  'cleanup-exam-entry-attempts',
  '17 3 * * *',
  $$select cleanup_exam_entry_attempts();$$
);

revoke all on function auto_submit_expired_sessions() from public;
grant execute on function auto_submit_expired_sessions() to service_role;
