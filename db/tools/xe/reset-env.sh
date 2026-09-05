#!/usr/bin/env bash
# dev 의 데이터를 전부 지우고 시드·테스트 계정만 남긴다 (XE ETL 재투입 전용). prod 에는 실행되지 않는다.
#   AWS_PROFILE=gforest db/tools/xe/reset-env.sh dev
# 전제: RDS 비상 개방(docs/conventions/cicd-and-ops.md) + psql(libpq). 미디어 버킷의 attachments/·avatars/ 객체도 지운다.
set -euo pipefail
env_name="${1:?dev}"
[ "$env_name" = dev ] || { echo "dev 만 허용"; exit 1; }
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../../.." && pwd)"
admin_url=$(aws ssm get-parameter --with-decryption --name "/gforest/${env_name}/DATABASE_ADMIN_URL" --query Parameter.Value --output text)
bucket="gforest-media-${env_name}-$(aws sts get-caller-identity --query Account --output text)"

echo "== truncate ($env_name)"
psql "$admin_url" -v ON_ERROR_STOP=1 -q <<'SQL'
truncate table public.attachments, public.comments, public.posts, public.role_audit,
  public.profiles, auth.password_reset_tokens, auth.users,
  public.boards, public.static_pages, public.spaces restart identity cascade;
SQL
echo "== seed + grants"
"$repo/db/bootstrap.sh" "$env_name" >/dev/null
echo "== test accounts (db/local/sample.sql)"
psql "$admin_url" -v ON_ERROR_STOP=1 -q -1 < "$repo/db/local/sample.sql"
echo "== media bucket cleanup: s3://$bucket/{attachments,avatars}/"
aws s3 rm "s3://$bucket/attachments/" --recursive --only-show-errors
aws s3 rm "s3://$bucket/avatars/" --recursive --only-show-errors
echo "done — 이제 DATABASE_ADMIN_URL=<SSM 값> npm run xe:etl -- --anonymize"
