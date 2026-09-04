#!/usr/bin/env bash
# [1회성 컷오버 도구] 이전 시스템(Supabase Storage) → S3 미디어 버킷 복사. 객체 키는 "<bucket>/<object name>" 으로 유지한다.
# 최종 컷오버 때 prod 로 미디어를 옮기는 용도로만 남겨 둔다(dev 는 2026-09-04 완료). 평소 개발·운영에서는 쓰지 않으며,
# 이전 시스템 폐기 후 삭제한다. 멱등(이미 있는 키는 건너뜀).
# 사용: AWS_PROFILE=gforest db/tools/copy_storage_from_supabase.sh dev|prod
# 전제: .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (평소 .env.local.example 에는 없음 — 실행 때만 추가)
#       소스 DB 접속 문자열 SB_URL(환경변수)
set -euo pipefail
env_name="${1:?dev|prod}"
export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
repo="$(cd "$(dirname "$0")/../.." && pwd)"  # db/tools → repo 루트
sb_url=$(grep -oE '^NEXT_PUBLIC_SUPABASE_URL=.*' "$repo/.env.local" | cut -d= -f2-)
sb_key=$(grep -oE '^SUPABASE_SECRET_KEY=.*' "$repo/.env.local" | cut -d= -f2-)
bucket="gforest-media-${env_name}-$(aws sts get-caller-identity --query Account --output text)"
: "${SB_URL:?소스 DB 접속 문자열 SB_URL 필요}"

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
psql "$SB_URL" -tA -F $'\t' -c "select bucket_id, name, coalesce(metadata->>'mimetype','application/octet-stream') from storage.objects order by bucket_id, name" > "$tmp/list.tsv"
total=$(wc -l < "$tmp/list.tsv"); n=0; skipped=0
while IFS=$'\t' read -r -u 3 b name mime; do
  n=$((n+1)); key="$b/$name"
  if aws s3api head-object --bucket "$bucket" --key "$key" >/dev/null 2>&1 </dev/null; then skipped=$((skipped+1)); continue; fi
  f="$tmp/obj"; 
  enc=$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe="/"))' "$name")
  curl -fsS -o "$f" -H "Authorization: Bearer $sb_key" -H "apikey: $sb_key" "$sb_url/storage/v1/object/$b/$enc" </dev/null
  aws s3 cp --only-show-errors --content-type "$mime" "$f" "s3://$bucket/$key" </dev/null
  printf '\r%d/%d %s' "$n" "$total" "$key"
done 3< "$tmp/list.tsv"
echo; echo "done: $total objects ($skipped already present) → s3://$bucket"
