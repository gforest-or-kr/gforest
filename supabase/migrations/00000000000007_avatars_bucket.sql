-- [RDS 미적용] Supabase Storage 전용 정책. 2026-09부터 S3 + presigned URL(lib/storage.ts)로 대체. infra/db/bootstrap.sh가 이 파일을 건너뛴다.
-- 프로필 아바타 Storage 버킷 (GFM-55)
--
-- 아바타는 민감하지 않고 다른 회원(헤더·마이페이지 등)에게도 노출되므로 public 버킷이 적절하다
-- (서명 URL 오버헤드 불필요 — slides의 'site' 버킷과 동일 판단). 공개 읽기는 공개 URL로 제공되어
-- select 정책 불필요. 쓰기는 본인 폴더({uid}/...)에만(첨부 self-folder 정책과 동일 패턴).
-- 업로드는 브라우저에서 직접(anon key + 사용자 세션), 클라에서 장변 400px 정사각 축소본만 올린다.

insert into storage.buckets (id, name, public, file_size_limit)
values ('avatars', 'avatars', true, 1048576)  -- 1MB
on conflict (id) do nothing;

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
