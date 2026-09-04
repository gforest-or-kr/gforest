#!/usr/bin/env bash
# DB 부트스트랩 + db/migrations 적용 + (비어 있으면) 시드. 재실행해도 안전(멱등).
#   db/bootstrap.sh local                 로컬 docker compose 의 Postgres (컨테이너 안 psql 사용 — libpq 설치 불필요)
#   AWS_PROFILE=gforest db/bootstrap.sh dev|prod   RDS. 관리자 URL 은 SSM, RDS 가 이 머신에서 접근 가능해야 함(비상 절차)
#     → 평소 dev/prod 마이그레이션은 배포 파이프라인(ecs-deploy.yml 의 migrate 단계)이 VPC 안에서 실행한다.
#
# 적용 이력은 public.schema_migrations(version) 로 추적한다. 파일명(확장자 제외)이 version.
# 참고: dev DB 에는 2026-09 이관 때 기록된 4개 version(…02_storage_attachments, …03_storage_upload_policy,
#       …04_storage_slides, …07_avatars_bucket)이 남아 있다 — 이전 시스템의 스토리지 정책 파일로 repo 에서는
#       삭제됐다. 기록만 남은 것이라 무해하며 지우지 않아도 된다.
set -euo pipefail
env_name="${1:?local|dev|prod}"
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"

if [ "$env_name" = local ]; then
  # 컨테이너 안의 psql. SQL 파일은 stdin 으로 넘긴다(./db 가 /db 로 마운트돼 있지만 경로 의존을 피함).
  psql_cmd=(docker compose -f "$repo/docker-compose.yml" exec -T db psql -U gforest_admin -d gforest)
  app_password="gforest_app"
  admin_url="postgresql://gforest_admin:gforest@localhost:5432/gforest" # docker-compose.yml 의 고정값
else
  export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
  admin_url=$(aws ssm get-parameter --with-decryption --name "/gforest/${env_name}/DATABASE_ADMIN_URL" --query Parameter.Value --output text)
  psql_cmd=(psql "$admin_url")
  # 앱 롤 비밀번호: 기존 SSM 값이 있으면 재사용, 없으면 생성
  if app_url=$(aws ssm get-parameter --with-decryption --name "/gforest/${env_name}/DATABASE_URL" --query Parameter.Value --output text 2>/dev/null); then
    app_password=$(sed -E 's#^postgresql://[^:]+:([^@]+)@.*#\1#' <<<"$app_url")
  else
    app_password=$(openssl rand -hex 16)
  fi
fi
run_psql() { "${psql_cmd[@]}" -v ON_ERROR_STOP=1 -q "$@"; }

echo "== bootstrap (auth schema, uid(), gforest_app)"
run_psql -v app_password="$app_password" < "$here/bootstrap_rds.sql"

echo "== migrations (db/migrate.mjs — 배포 파이프라인과 같은 구현)"
DATABASE_ADMIN_URL="$admin_url" node "$here/migrate.mjs"

if [ "$("${psql_cmd[@]}" -tAc "select count(*) from public.boards")" = 0 ]; then
  echo "== seed (boards 비어 있음)"
  run_psql -1 < "$here/seed.sql"
fi

if [ "$env_name" = local ]; then
  echo "== local sample data"
  run_psql -1 < "$here/local/sample.sql"
  echo "== DATABASE_URL=postgresql://gforest_app:gforest_app@localhost:5432/gforest (.env.local.example 과 동일)"
else
  host_db=$(sed -E 's#^postgresql://[^@]+@(.*)$#\1#' <<<"$admin_url")
  aws ssm put-parameter --name "/gforest/${env_name}/DATABASE_URL" --type SecureString --overwrite \
    --value "postgresql://gforest_app:${app_password}@${host_db}" >/dev/null
  echo "== SSM /gforest/${env_name}/DATABASE_URL updated"
fi
