-- Test 시험 · 개별 시작 시험(exam_date null)도 서버 백업 auto-submit 대상에 포함
-- - 기존: exam.exam_date + duration_minutes 기준만 감지
-- - 추가: exam_sessions.start_time + duration_minutes 기준도 감지
-- 클라이언트 자동 제출이 실패하더라도 서버가 매분 만료 세션을 강제 제출

create or replace function auto_submit_expired_sessions()
returns void
language plpgsql
security definer
as $$
declare
  submitted_count int;
begin
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
      and (
        -- A. exam_date 기반 만료 (실 시험 · 정해진 시각에 일제히 시작)
        (
          e.exam_date is not null
          and e.exam_date
              + ((e.duration_minutes + coalesce(es.time_extension_minutes, 0))
                 || ' minutes')::interval <= now()
        )
        or
        -- B. start_time 기반 만료 (Test 시험 · 개별 시작 시험)
        (
          es.start_time is not null
          and es.start_time
              + ((e.duration_minutes + coalesce(es.time_extension_minutes, 0))
                 || ' minutes')::interval <= now()
        )
      )
    returning es.id
  )
  select count(*) into submitted_count from expired;

  if submitted_count > 0 then
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

-- 확인: select * from cron.job where jobname = 'auto-submit-expired-exams';
-- cron job은 20260715000003에서 이미 등록됨. 함수만 교체.
