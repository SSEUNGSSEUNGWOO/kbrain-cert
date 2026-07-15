-- 시험 종료 시각 자동 제출 (pg_cron)
-- 클라이언트 페이지가 닫혀 있어도 서버가 매분 만료 세션을 강제 제출
-- 종료 기준: exam.exam_date + exam.duration_minutes <= now()

-- pg_cron extension enable
create extension if not exists pg_cron;

-- 만료 세션 auto submit 함수
create or replace function auto_submit_expired_sessions()
returns void
language plpgsql
security definer
as $$
declare
  submitted_count int;
begin
  -- exam_date가 있는 시험 · 종료 시각이 지났고 아직 제출 안 된 세션 강제 제출
  with expired as (
    update exam_sessions es
    set status = 'submitted',
        submit_time = now(),
        auto_submitted = true,
        updated_at = now()
    from exams e
    where es.exam_id = e.id
      and es.submit_time is null
      and es.status <> 'submitted'
      and e.exam_date is not null
      and e.exam_date + (e.duration_minutes || ' minutes')::interval <= now()
    returning es.id
  )
  select count(*) into submitted_count from expired;

  if submitted_count > 0 then
    -- 방금 제출된 세션들의 answers도 submitted_at 채우기
    update answers a
    set submitted_at = now()
    from exam_sessions es
    where a.session_id = es.id
      and a.submitted_at is null
      and es.submit_time is not null;

    raise notice '[auto-submit] % sessions submitted', submitted_count;
  end if;
end;
$$;

-- 매분 실행 (0-59분마다)
select cron.schedule(
  'auto-submit-expired-exams',
  '* * * * *',
  $$select auto_submit_expired_sessions();$$
);

-- 확인: select * from cron.job;
-- 삭제(필요 시): select cron.unschedule('auto-submit-expired-exams');
