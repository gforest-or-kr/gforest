-- 소프트 삭제(deleted_at 설정) RLS 충돌 수정 (GFM)
--
-- 문제: comments_select/posts_select가 `deleted_at is null`로 필터링하는데, 소프트 삭제는
-- UPDATE로 deleted_at을 채운다. 그러면 '새 행'이 SELECT 정책을 통과하지 못해 PostgreSQL이
-- UPDATE 자체를 RLS 위반(42501)으로 거부한다 → 작성자가 자기 댓글/글을 삭제할 수 없었다
-- (admin만 is_admin()으로 가능). 검증: 작성자 author_id = auth.uid()인데도 deleted_at UPDATE가 42501.
--
-- 수정: SELECT 정책의 가시성 조건에 `or author_id = auth.uid() or is_admin()`을 더해, 작성자·관리자가
-- 소프트 삭제(자기/모든 글)를 수행할 때 새 행이 SELECT를 통과하게 한다. 일반 사용자에겐 삭제글이
-- 여전히 숨겨진다(세 조건 모두 false). 앱은 모든 조회에서 `.is('deleted_at', null)`로 한 번 더
-- 거르므로 작성자/관리자 UI에도 삭제글은 노출되지 않는다(심층 방어).

alter policy comments_select on public.comments
  using (
    (deleted_at is null or author_id = auth.uid() or public.is_admin())
    and exists (
      select 1 from public.posts p
      where p.id = post_id and public.can_read_board(p.board_id)
    )
  );

alter policy posts_select on public.posts
  using (
    (deleted_at is null or author_id = auth.uid() or public.is_admin())
    and public.can_read_board(board_id)
  );
