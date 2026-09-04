-- gforest-web 초기 스키마 v1 (2026-06-11)
-- 설계 근거: docs/design/db_schema.md, 화면설계서 v1.1, 게시판 권한 매트릭스
-- 원칙: 표준 Postgres 중심(이식성), 게시판/권한은 데이터로 관리(코드 수정 없이 운영)

-- ============================================================
-- 1. 역할 / 프로필
-- ============================================================

-- 역할: 익명은 비로그인 상태로 표현(행 없음). pending = 가입 후 승인 대기
create type public.app_role as enum ('pending', 'member', 'operator', 'teacher', 'student', 'admin');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nickname    text not null unique check (char_length(nickname) between 2 and 20),
  name        text not null,
  avatar_path text,
  role        public.app_role not null default 'pending',
  bio         text,                       -- 가입 인사/소개 (승인 판단 참고)
  legacy_member_srl bigint unique,        -- XE xe_member.member_srl 매핑 (ETL 멱등성)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is '회원 프로필. 역할 승급은 admin만 가능(RLS + 트리거)';

-- 현재 사용자의 역할 조회 (RLS 정책에서 공용 사용)
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- 역할(role) 컬럼은 본인이 변경 불가 — admin 전용
create or replace function public.guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'role change requires admin';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_role_change();

-- 역할 변경 감사 로그
create table public.role_audit (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  old_role    public.app_role,
  new_role    public.app_role not null,
  changed_by  uuid references public.profiles (id),
  changed_at  timestamptz not null default now()
);

create or replace function public.log_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    insert into public.role_audit (user_id, old_role, new_role, changed_by)
    values (new.id, old.role, new.role, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_profiles_role_audit
  after update on public.profiles
  for each row execute function public.log_role_change();

-- ============================================================
-- 2. 게시판 (데이터로 관리 — SCR-603)
-- ============================================================

create type public.board_type as enum ('list', 'gallery', 'calendar', 'reservation');

create table public.boards (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,                 -- URL: /boards/{slug}
  name        text not null,
  description text,
  menu_group  text not null,                        -- 학교소식 | 커뮤니티 | 학부모학생 | 운영위교사
  sort_order  int  not null default 0,
  board_type  public.board_type not null default 'list',
  -- 권한: null/빈 배열 = 익명 포함 전체 공개 읽기. 그 외 = 나열된 역할 + admin만
  read_roles  public.app_role[],
  write_roles public.app_role[] not null default '{member,operator,teacher,admin}',
  is_active   boolean not null default true,
  legacy_mid  text unique,                          -- XE mid 매핑 (board_noti 등)
  created_at  timestamptz not null default now()
);

comment on column public.boards.read_roles is 'null = 공개(익명 읽기 가능). admin은 항상 허용';

-- 게시판 읽기 권한 체크 (posts/comments RLS에서 사용)
create or replace function public.can_read_board(b_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.boards b
    where b.id = b_id and b.is_active
      and ( b.read_roles is null
            or cardinality(b.read_roles) = 0
            or public.current_app_role() = any (b.read_roles)
            or public.is_admin() )
  );
$$;

create or replace function public.can_write_board(b_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.boards b
    where b.id = b_id and b.is_active
      and ( public.current_app_role() = any (b.write_roles) or public.is_admin() )
  );
$$;

-- ============================================================
-- 3. 예약 공간 / 게시글 / 댓글 / 첨부
-- ============================================================

create table public.spaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,    -- 강당, 음악실, …
  color      text not null default '#2f9e6e',
  is_active  boolean not null default true,
  sort_order int not null default 0
);

create table public.posts (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id),
  author_id   uuid not null references public.profiles (id),
  title       text not null check (char_length(title) between 1 and 200),
  content     text not null default '',              -- sanitize된 HTML
  is_notice   boolean not null default false,        -- 목록 상단 고정 (운영진)
  view_count  int not null default 0,
  -- 일정(calendar) / 예약(reservation) 확장 필드
  event_date  date,
  event_start timestamptz,
  event_end   timestamptz,
  space_id    uuid references public.spaces (id),
  legacy_document_srl bigint unique,                 -- XE xe_documents 매핑
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,                           -- soft delete
  constraint event_range check (event_end is null or event_start is null or event_end > event_start)
);

create index posts_board_created_idx on public.posts (board_id, created_at desc) where deleted_at is null;
create index posts_event_idx on public.posts (board_id, event_date) where event_date is not null and deleted_at is null;
create index posts_author_idx on public.posts (author_id);

-- 예약 시간 중복 차단 (같은 공간, 겹치는 시간대) — SCR-303
create extension if not exists btree_gist;
alter table public.posts add constraint no_reservation_overlap
  exclude using gist (
    space_id with =,
    tstzrange(event_start, event_end) with &&
  ) where (space_id is not null and event_start is not null and deleted_at is null);

create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  author_id   uuid not null references public.profiles (id),
  parent_id   uuid references public.comments (id),   -- 1단계 대댓글 (앱에서 깊이 제한)
  content     text not null check (char_length(content) between 1 and 4000),
  legacy_comment_srl bigint unique,                   -- XE xe_comments 매핑
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index comments_post_idx on public.comments (post_id, created_at);

create table public.attachments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id),
  storage_path text not null,                         -- attachments 버킷 내 경로
  file_name   text not null,
  byte_size   bigint not null check (byte_size > 0),
  mime_type   text not null,
  legacy_file_srl bigint unique,                      -- XE xe_files 매핑
  created_at  timestamptz not null default now()
);

create index attachments_post_idx on public.attachments (post_id);

-- 조회수 증가 (클라이언트 직접 update 차단, RPC만 허용)
create or replace function public.increment_view_count(p_post_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.posts set view_count = view_count + 1 where id = p_post_id;
$$;

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger trg_posts_touch before update on public.posts for each row execute function public.touch_updated_at();
create trigger trg_comments_touch before update on public.comments for each row execute function public.touch_updated_at();

-- ============================================================
-- 4. 사이트 콘텐츠 (메인/팝업/슬라이더/정적 페이지 — SCR-601/602/604)
-- ============================================================

create table public.popups (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null default '',
  image_path   text,
  link_url     text,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz not null,
  dismiss_days int not null default 3 check (dismiss_days between 1 and 30),
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.slides (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  subtitle           text,
  link_url           text,
  image_desktop_path text not null,   -- 1200x450
  image_mobile_path  text not null,   -- 750x420
  sort_order         int not null default 0,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

create table public.static_pages (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,    -- /about/{slug}
  title      text not null,
  content    text not null default '',
  menu_group text not null default '학교소개',
  sort_order int not null default 0,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. RLS 정책
-- ============================================================

alter table public.profiles     enable row level security;
alter table public.role_audit   enable row level security;
alter table public.boards       enable row level security;
alter table public.spaces       enable row level security;
alter table public.posts        enable row level security;
alter table public.comments     enable row level security;
alter table public.attachments  enable row level security;
alter table public.popups       enable row level security;
alter table public.slides       enable row level security;
alter table public.static_pages enable row level security;

-- profiles: 닉네임 등은 공개(글 작성자 표시용), 수정은 본인만(role은 트리거로 보호)
create policy profiles_select on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid() or public.is_admin());

-- role_audit: admin만 열람
create policy role_audit_select on public.role_audit for select using (public.is_admin());

-- boards/spaces: 메타데이터는 전체 공개(메뉴 렌더링), 변경은 admin
create policy boards_select on public.boards for select using (true);
create policy boards_admin  on public.boards for all using (public.is_admin()) with check (public.is_admin());
create policy spaces_select on public.spaces for select using (true);
create policy spaces_admin  on public.spaces for all using (public.is_admin()) with check (public.is_admin());

-- posts: 게시판 read_roles 기반 읽기 / write_roles 기반 작성 / 본인·admin 수정·삭제
create policy posts_select on public.posts for select
  using (deleted_at is null and public.can_read_board(board_id));
create policy posts_insert on public.posts for insert
  with check (author_id = auth.uid() and public.can_write_board(board_id));
create policy posts_update on public.posts for update
  using (author_id = auth.uid() or public.is_admin());
create policy posts_delete on public.posts for delete
  using (public.is_admin());   -- 일반 삭제는 soft delete(update)로 처리

-- comments: 게시판 읽기 가능자만 열람, 쓰기는 로그인+게시판 읽기 권한(기존 사이트 정책 계승)
create policy comments_select on public.comments for select
  using (deleted_at is null and exists (
    select 1 from public.posts p where p.id = post_id and public.can_read_board(p.board_id)));
create policy comments_insert on public.comments for insert
  with check (author_id = auth.uid()
    and public.current_app_role() <> 'pending'
    and exists (select 1 from public.posts p where p.id = post_id and public.can_read_board(p.board_id)));
create policy comments_update on public.comments for update
  using (author_id = auth.uid() or public.is_admin());

-- attachments: 소속 게시글 읽기 권한 따라감
create policy attachments_select on public.attachments for select
  using (exists (select 1 from public.posts p where p.id = post_id and public.can_read_board(p.board_id)));
create policy attachments_insert on public.attachments for insert
  with check (uploader_id = auth.uid()
    and exists (select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()));
create policy attachments_delete on public.attachments for delete
  using (uploader_id = auth.uid() or public.is_admin());

-- popups/slides/static_pages: 공개 읽기, admin 쓰기
create policy popups_select on public.popups for select using (true);
create policy popups_admin  on public.popups for all using (public.is_admin()) with check (public.is_admin());
create policy slides_select on public.slides for select using (true);
create policy slides_admin  on public.slides for all using (public.is_admin()) with check (public.is_admin());
create policy static_pages_select on public.static_pages for select using (true);
create policy static_pages_admin  on public.static_pages for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- 6. 가입 트리거: auth.users → profiles 자동 생성 (pending)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, name, bio)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nickname', 'user_' || left(new.id::text, 8)),
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'bio'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
