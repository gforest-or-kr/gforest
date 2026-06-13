#!/usr/bin/env bash
# ISR 스모크 게이트 — 글 상세가 prod 빌드에서 200으로 뜨는지 검증한다.
#
# 왜 필요한가: next dev 서버는 항상 동적 렌더라 ISR 런타임 오류
# (DYNAMIC_SERVER_USAGE 등 — layout이 쿠키를 읽어 정적 페이지가 깨지는 류)를
# 절대 못 잡는다. 실제로 글 상세 ISR이 dev·preview에선 200, 프로덕션에서만 500이
# 났던 사고가 있었다. 그래서 이 스크립트는 프로덕션과 동일 경로를 친다:
#   next build (정적 ● 생성) → next start (prod 모드) → 실제 글 URL 요청 → 200 검증.
# CI(deploy.yml)에서 vercel deploy '직전'에 돌려, 깨진 빌드가 배포되는 걸 막는다.
#
# 사전조건: Supabase env가 환경변수에 로드돼 있어야 한다(CI는 vercel pull, 로컬은 .env.local).
set -euo pipefail

PORT="${SMOKE_PORT:-3100}"
BASE="http://localhost:$PORT"
BOARD="${SMOKE_BOARD:-notice}"   # 공개 게시판(ISR 대상)
STARTLOG="$(mktemp -t isr-smoke-start.XXXXXX)"
BODY="$(mktemp -t isr-smoke-post.XXXXXX)"

echo "▶ next build"
npx next build

echo "▶ next start (:$PORT) — prod 모드"
npx next start -p "$PORT" >"$STARTLOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

# 서버 기동 대기 (최대 40s)
up=0
for _ in $(seq 1 40); do
  if curl -sf "$BASE/" >/dev/null 2>&1; then up=1; break; fi
  sleep 1
done
if [ "$up" != 1 ]; then
  echo "::error::next start 기동 실패"; tail -40 "$STARTLOG"; exit 1
fi

# 목록에서 첫 글 경로 추출 — 글 ID 하드코딩 회피(글이 지워져도 견고)
LIST=$(curl -s "$BASE/boards/$BOARD")
POST=$(printf '%s' "$LIST" | grep -oE "/boards/$BOARD/[0-9a-f-]+" | head -1 || true)
if [ -z "$POST" ]; then
  echo "::error::목록(/boards/$BOARD)에서 글 링크를 못 찾음 — 게시판이 비었거나 목록이 깨짐"
  exit 1
fi
echo "▶ 샘플 글: $POST"

CODE=$(curl -s -o "$BODY" -w '%{http_code}' "$BASE$POST")
echo "▶ 글 상세 HTTP $CODE"

fail=0
[ "$CODE" = "200" ] || { echo "::error::글 상세 HTTP $CODE (200 아님 — ISR 런타임 생성 실패 의심)"; fail=1; }
if grep -q "DYNAMIC_SERVER_USAGE" "$BODY"; then
  echo "::error::DYNAMIC_SERVER_USAGE 검출 — 정적 페이지가 동적 API(쿠키 등)를 호출함"; fail=1
fi
# 빈 셸/에러 페이지 방어 — 진짜 제목(h1)이 렌더됐는지
if ! grep -qE '<h1[^>]*>[^<]+</h1>' "$BODY"; then
  echo "::error::글 상세에 제목(h1)이 없음 — 렌더 실패 의심"; fail=1
fi

if [ "$fail" = 0 ]; then
  echo "✅ ISR 스모크 통과 (글 상세 200 + 제목 렌더 + 동적오류 없음)"
else
  echo "❌ ISR 스모크 실패 — 아래는 서버 로그 마지막 40줄"
  tail -40 "$STARTLOG"
fi
exit $fail
