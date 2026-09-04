-- 공지 고정(is_notice) 권한 강제 (GFM-57)
--
-- posts_update RLS는 author/admin이면 모든 컬럼을 바꿀 수 있어, 일반 작성자가 자기 글을
-- 임의로 공지 고정할 수 있었다. is_notice 지정/해제는 '운영자·관리자'만 가능하도록 트리거로
-- 강제한다(guard_role_change와 동일 패턴, raise 대신 값 되돌리기 = graceful).
--   - 비로그인(service role / ETL: auth.uid() null)은 신뢰 → 통과(레거시 공지 import 보존).
--   - 로그인했지만 admin/operator가 아니면: INSERT는 false로, UPDATE는 기존 값으로 되돌린다.

create or replace function public.guard_is_notice()
returns trigger language plpgsql security definer set search_path = public as $$
declare r public.app_role := public.current_app_role();
begin
  if auth.uid() is not null and (r is null or r not in ('admin', 'operator')) then
    if tg_op = 'INSERT' then
      new.is_notice := false;
    elsif new.is_notice is distinct from old.is_notice then
      new.is_notice := old.is_notice;
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_posts_guard_notice
  before insert or update on public.posts
  for each row execute function public.guard_is_notice();
