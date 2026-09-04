-- [RDS 미적용] Supabase Storage 전용 정책. 2026-09부터 S3 + presigned URL(lib/storage.ts)로 대체. infra/db/bootstrap.sh가 이 파일을 건너뛴다.
-- 첨부파일 Storage 업로드(insert)·삭제(delete) 정책
-- 00000000000002가 예고한 글쓰기 첨부용 insert 정책. 업로드는 브라우저에서 직접 수행한다(anon key + 사용자 세션).
-- 경로 규칙: 첫 번째 폴더 = 본인 uid ({auth.uid()}/{uuid}.{ext})

-- 첨부 업로드: 로그인 + pending 아님 + 본인 폴더({uid}/...)에만 업로드 가능
-- (게시판별 쓰기 권한은 업로드 시점엔 글이 없어 검사 불가 — attachments 행 insert RLS가 최종 강제)
create policy attachments_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_app_role() <> 'pending'
  );

-- 본인 폴더 파일 삭제 허용 (등록 전 첨부 취소용)
create policy attachments_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
