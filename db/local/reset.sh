#!/usr/bin/env bash
# 로컬 DB·MinIO 를 볼륨까지 지우고 다시 만든 뒤 스키마·시드·샘플을 적용한다. 사용: npm run db:reset
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo"
docker compose down -v --remove-orphans
docker compose up -d --wait
db/bootstrap.sh local
echo
echo "로컬 준비 완료 — npm run dev 후 http://localhost:3000 (테스트 계정은 db/local/sample.sql 상단)"
