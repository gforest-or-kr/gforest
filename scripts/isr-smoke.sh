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

# 회원 게시판 글 경로 — 비로그인으로 요청해도 500이 아니라 200(권한 안내 SSR)이어야 한다.
# 글 상세 라우트는 권한검사에 쿠키(세션)를 읽는다. 라우트가 정적(●)이면 그 쿠키 읽기가
# 프로덕션 런타임 생성 시점에 DYNAMIC_SERVER_USAGE를 던져 500이 난다(GFM-47 사고).
# 공개글만 검사하면 이 회귀를 놓친다. 더미 UUID면 충분하다 — 권한검사(쿠키)가 글 조회보다
# 먼저 일어나 비로그인은 AccessNotice(200)로 끝나므로, 실제 멤버 글 ID가 없어도 경로가 탄다.
MBOARD="${SMOKE_MEMBER_BOARD:-free}"
MPOST="/boards/$MBOARD/00000000-0000-0000-0000-000000000000"
echo "▶ 멤버 게시판 경로(비로그인, 더미 ID): $MPOST"
MCODE=$(curl -s -o "$BODY" -w '%{http_code}' "$BASE$MPOST")
echo "▶ 멤버 글 상세(비로그인) HTTP $MCODE"
[ "$MCODE" = "200" ] || { echo "::error::멤버 글 비로그인 HTTP $MCODE (200 권한안내 아님 — 라우트가 정적인데 쿠키 읽음 의심)"; fail=1; }
if grep -q "DYNAMIC_SERVER_USAGE" "$BODY"; then
  echo "::error::멤버 글에서 DYNAMIC_SERVER_USAGE 검출 — 라우트가 동적(ƒ)이 아님"; fail=1
fi

# 회원 글 경로 번들 예산 가드(GFM-66) — 회원 글은 '정적 셸 + 클라 fetch'라 콘텐츠 표시가
# 하이드레이션 완료에 의존한다. 초기 JS가 조용히 비대해지면(무거운 라이브러리 유입 등)
# 저사양 모바일 체감이 직접 나빠지므로, 초기 HTML의 <script src> 청크를 실제로 받아
# gzip 전송량 합계를 예산과 비교한다(빌드 매니페스트 대신 실측 — Turbopack 등 툴체인 무관).
BUDGET_KB="${SMOKE_BUNDLE_BUDGET_KB:-300}"   # 2026-07 실측 254KB + 여유. 배경: docs/design/rendering.md
TOTAL=0
for s in $(grep -oE 'src="[^"]*/_next/[^"]+\.js[^"]*"' "$BODY" | sed 's/^src="//; s/"$//' | sort -u); do
  sz=$(curl -s -H 'Accept-Encoding: gzip' -o /dev/null -w '%{size_download}' "$BASE$s")
  TOTAL=$((TOTAL + sz))
done
TOTAL_KB=$((TOTAL / 1024))
echo "▶ 회원 글 초기 JS ${TOTAL_KB}KB gz (예산 ${BUDGET_KB}KB)"
if [ "$TOTAL" -eq 0 ]; then
  echo "::error::초기 JS 청크를 하나도 못 받음 — HTML이 깨졌거나 측정 로직 회귀"; fail=1
elif [ "$TOTAL_KB" -gt "$BUDGET_KB" ]; then
  echo "::error::회원 경로 번들 예산 초과 ${TOTAL_KB}KB > ${BUDGET_KB}KB — 새로 유입된 무거운 import를 확인할 것 (docs/design/rendering.md 번들 예산)"; fail=1
fi

if [ "$fail" = 0 ]; then
  echo "✅ ISR 스모크 통과 (글 상세 200 + 제목 렌더 + 동적오류 없음 + 번들 예산 이내)"
else
  echo "❌ ISR 스모크 실패 — 아래는 서버 로그 마지막 40줄"
  tail -40 "$STARTLOG"
fi
exit $fail
