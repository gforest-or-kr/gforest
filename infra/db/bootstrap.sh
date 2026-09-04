#!/usr/bin/env bash
# RDS 최초 부트스트랩 + supabase/migrations 적용 + 앱 접속 문자열을 SSM 에 기록.
# 사용: AWS_PROFILE=gforest infra/db/bootstrap.sh dev
# 전제: RDS 가 이 머신에서 접근 가능(dev: db_publicly_accessible), psql 설치(brew install libpq)
set -euo pipefail
env_name="${1:?dev|prod}"
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"

admin_url=$(aws ssm get-parameter --with-decryption --name "/gforest/${env_name}/DATABASE_ADMIN_URL" --query Parameter.Value --output text)

# 앱 롤 비밀번호: 기존 SSM 값이 있으면 재사용, 없으면 생성
if app_url=$(aws ssm get-parameter --with-decryption --name "/gforest/${env_name}/DATABASE_URL" --query Parameter.Value --output text 2>/dev/null); then
  app_password=$(sed -E 's#^postgresql://[^:]+:([^@]+)@.*#\1#' <<<"$app_url")
else
  app_password=$(openssl rand -hex 16)
fi

echo "== bootstrap (auth schema, uid(), gforest_app)"
psql "$admin_url" -v ON_ERROR_STOP=1 -v app_password="$app_password" -q -f "$here/bootstrap_rds.sql"

echo "== migrations"
# Supabase Storage 전용(storage.buckets/objects 정책) 마이그레이션은 RDS에 적용 대상이 아님 — 적용됨으로만 기록
SKIP_STORAGE_ONLY="00000000000002_storage_attachments 00000000000003_storage_upload_policy 00000000000004_storage_slides 00000000000007_avatars_bucket"
psql "$admin_url" -v ON_ERROR_STOP=1 -q -c "create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())"
for f in "$repo"/supabase/migrations/*.sql; do
  v=$(basename "$f" .sql)
  if psql "$admin_url" -tAc "select 1 from public.schema_migrations where version='$v'" | grep -q 1; then
    echo "   skip $v"; continue
  fi
  if [[ " $SKIP_STORAGE_ONLY " == *" $v "* ]]; then
    echo "   skip(storage-only) $v"
    psql "$admin_url" -q -c "insert into public.schema_migrations(version) values ('$v')"; continue
  fi
  echo "   apply $v"
  psql "$admin_url" -v ON_ERROR_STOP=1 -q -1 -f "$f" -c "insert into public.schema_migrations(version) values ('$v')"
done

echo "== grants on existing objects"
psql "$admin_url" -v ON_ERROR_STOP=1 -q <<'SQL'
grant select, insert, update, delete on all tables in schema public to gforest_app;
grant usage, select on all sequences in schema public to gforest_app;
grant execute on all functions in schema public to gforest_app;
SQL

host_db=$(sed -E 's#^postgresql://[^@]+@(.*)$#\1#' <<<"$admin_url")
aws ssm put-parameter --name "/gforest/${env_name}/DATABASE_URL" --type SecureString --overwrite \
  --value "postgresql://gforest_app:${app_password}@${host_db}" >/dev/null
echo "== SSM /gforest/${env_name}/DATABASE_URL updated"
