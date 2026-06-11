-- 첨부파일 Storage 버킷 + 읽기 정책
-- 다운로드(서명 URL 생성)는 게시판 read 권한과 동일하게 RLS로 강제한다.
-- 업로드는 현재 ETL(service key)만 수행 — 글쓰기 첨부 기능 추가 시 insert 정책 별도 작성.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 10485760)
on conflict (id) do nothing;

create policy attachments_read on storage.objects for select
  using (
    bucket_id = 'attachments'
    and exists (
      select 1
      from public.attachments a
      join public.posts p on p.id = a.post_id
      where a.storage_path = storage.objects.name
        and p.deleted_at is null
        and public.can_read_board(p.board_id)
    )
  );
