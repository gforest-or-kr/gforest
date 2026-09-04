-- RDS 인스턴스 최초 1회 부트스트랩. db/migrations 를 적용하기 *전에* 관리자로 실행한다 (db/bootstrap.sh 가 호출).
-- 마이그레이션·RLS 정책이 전제하는 auth 스키마 객체를 만든다.
--   * auth.users        : 사용자 테이블 (Auth.js Credentials 가 사용)
--   * auth.uid()        : RLS 정책이 참조하는 현재 사용자 — 앱이 트랜잭션마다 set local app.user_id 로 주입
--   * gforest_app 롤    : 테이블 소유자가 아니므로 RLS 가 강제되는 앱 전용 접속 롤

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists btree_gist;

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null unique,
  encrypted_password text,                        -- bcrypt ($2a$/$2b$), 이전 시스템(2026-09 이관)에서 그대로 옮김
  email_confirmed_at timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  last_sign_in_at    timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create unique index if not exists users_email_lower_idx on auth.users (lower(email));

-- 비밀번호 재설정 1회용 토큰 (해시만 저장, 만료 1시간). lib/auth-actions.ts
create table if not exists auth.password_reset_tokens (
  token_hash text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- 앱이 요청마다 set local app.user_id = '<uuid>' 로 설정. 미설정/빈 값이면 null (= 비로그인).
create or replace function auth.uid() returns uuid
  language sql stable
  as $$
    select nullif(current_setting('app.user_id', true), '')::uuid;
  $$;

-- 앱 전용 롤. 비밀번호는 bootstrap.sh 가 psql 변수(:app_password)로 넘긴다 (\gexec — DO 블록 안에서는 psql 변수가 치환되지 않음).
select format('create role gforest_app login password %L', :'app_password')
 where not exists (select 1 from pg_roles where rolname = 'gforest_app') \gexec
select format('alter role gforest_app password %L', :'app_password') \gexec

grant usage on schema public, auth to gforest_app;
grant select, insert, update on auth.users to gforest_app;
grant select, insert, delete on auth.password_reset_tokens to gforest_app;
-- public 스키마 객체는 마이그레이션 적용 후에도 자동으로 권한이 붙도록 기본 권한을 설정
alter default privileges for role gforest_admin in schema public grant select, insert, update, delete on tables to gforest_app;
alter default privileges for role gforest_admin in schema public grant usage, select on sequences to gforest_app;
alter default privileges for role gforest_admin in schema public grant execute on functions to gforest_app;
