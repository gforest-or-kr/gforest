#!/usr/bin/env bash
# Supabase Storage → S3 미디어 버킷 복사. 객체 키는 "<supabase bucket>/<object name>" 으로 유지한다.
# 사용: AWS_PROFILE=gforest infra/db/copy_storage.sh dev
# 전제: .env.local 의 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY / 소스 DB 접속 문자열 SB_URL(환경변수)
set -euo pipefail
env_name="${1:?dev|prod}"
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
repo="$(cd "$(dirname "$0")/../.." && pwd)"
sb_url=$(grep -oE '^NEXT_PUBLIC_SUPABASE_URL=.*' "$repo/.env.local" | cut -d= -f2-)
sb_key=$(grep -oE '^SUPABASE_SECRET_KEY=.*' "$repo/.env.local" | cut -d= -f2-)
bucket="gforest-media-${env_name}-$(aws sts get-caller-identity --query Account --output text)"
: "${SB_URL:?소스 DB 접속 문자열 SB_URL 필요}"

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
psql "$SB_URL" -tA -F $'\t' -c "select bucket_id, name, coalesce(metadata->>'mimetype','application/octet-stream') from storage.objects order by bucket_id, name" > "$tmp/list.tsv"
total=$(wc -l < "$tmp/list.tsv"); n=0; skipped=0
while IFS=$'\t' read -r b name mime; do
  n=$((n+1)); key="$b/$name"
  if aws s3api head-object --bucket "$bucket" --key "$key" >/dev/null 2>&1; then skipped=$((skipped+1)); continue; fi
  f="$tmp/obj"; 
  curl -fsS -o "$f" -H "Authorization: Bearer $sb_key" "$sb_url/storage/v1/object/$b/$name"
  aws s3 cp --only-show-errors --content-type "$mime" "$f" "s3://$bucket/$key"
  printf '\r%d/%d %s' "$n" "$total" "$key"
done < "$tmp/list.tsv"
echo; echo "done: $total objects ($skipped already present) → s3://$bucket"
