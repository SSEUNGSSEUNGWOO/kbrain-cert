-- 응시자 답안 파일 업로드 · Storage bucket + 정책
-- 파일 경로: answer-files/{sessionId}/{questionId}/{slotId}/{hash}.{ext}
-- 접근: service_role만 (모든 API에서 관리자 검증 or 세션 쿠키 검증 필수)

insert into storage.buckets (id, name, public, file_size_limit)
values ('answer-files', 'answer-files', false, 52428800)  -- 50MB 제한
on conflict (id) do nothing;

-- Storage policies는 service_role bypass하므로 별도 정책 불필요
