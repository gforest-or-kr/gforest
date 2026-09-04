-- [RDS 미적용] Supabase Storage 전용 정책. 2026-09부터 S3 + presigned URL(lib/storage.ts)로 대체. infra/db/bootstrap.sh가 이 파일을 건너뛴다.
-- 사이트 공개 이미지(메인 슬라이더 등) 버킷. 공개 읽기, 쓰기는 admin만.
-- 슬라이드는 비로그인 포함 전원에게 메인에서 노출되므로 공개 버킷이 적절하다
-- (서명 URL 오버헤드 불필요·민감하지 않음). 읽기는 공개 URL로 제공되어 select 정책 불필요.
-- public.is_admin()(마이그레이션 1)에만 의존 — 단독 적용 가능.

insert into storage.buckets (id, name, public, file_size_limit)
values ('site', 'site', true, 2097152)  -- 2MB: 슬라이드는 1200x450/750x420 사전 크롭본
on conflict (id) do nothing;

create policy site_admin_insert on storage.objects for insert
  with check (bucket_id = 'site' and public.is_admin());
create policy site_admin_update on storage.objects for update
  using (bucket_id = 'site' and public.is_admin());
create policy site_admin_delete on storage.objects for delete
  using (bucket_id = 'site' and public.is_admin());
