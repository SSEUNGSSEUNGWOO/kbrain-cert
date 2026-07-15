-- Supabase Realtime publication에 감독 모니터용 테이블 추가
-- monitoring_events INSERT / exam_sessions UPDATE 를 감독관 브라우저가 실시간 구독

-- 이미 있으면 스킵 (publication이 기본 supabase_realtime)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'monitoring_events'
  ) then
    alter publication supabase_realtime add table monitoring_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'exam_sessions'
  ) then
    alter publication supabase_realtime add table exam_sessions;
  end if;
end $$;

-- 확인: select * from pg_publication_tables where pubname = 'supabase_realtime';
