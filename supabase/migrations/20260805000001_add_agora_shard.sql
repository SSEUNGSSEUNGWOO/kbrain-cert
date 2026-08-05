-- 세션별 Agora 샤드(감독 영상 페이지) 고정 배정
-- 입장 시 미제출 인원이 정원(8명) 미만인 가장 앞 샤드에 배정해 앞 페이지부터 채운다.
-- null이면 기존 sessionId 해시 폴백 (마이그레이션 이전 세션 호환)
alter table exam_sessions add column if not exists agora_shard smallint;
