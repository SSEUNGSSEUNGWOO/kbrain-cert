-- 감독 화면 Realtime 구독용 읽기 정책
-- monitoring_events / exam_sessions는 RLS가 켜져 있어 publication 등록만으로는
-- 관리자·감독관 브라우저에 postgres_changes가 전달되지 않는다.

create or replace function public.is_exam_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'examiner')
  );
$$;

revoke all on function public.is_exam_staff() from public;
grant execute on function public.is_exam_staff() to authenticated;

drop policy if exists "staff_realtime_read_monitoring_events"
  on public.monitoring_events;
create policy "staff_realtime_read_monitoring_events"
  on public.monitoring_events
  for select
  to authenticated
  using (public.is_exam_staff());

drop policy if exists "staff_realtime_read_exam_sessions"
  on public.exam_sessions;
create policy "staff_realtime_read_exam_sessions"
  on public.exam_sessions
  for select
  to authenticated
  using (public.is_exam_staff());
