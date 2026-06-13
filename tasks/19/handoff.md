# handoff: #19

## 변경 파일

- `lib/supabase/public.ts` (신규): `lib/menu-data.ts`에 비공개로 있던 `publicClient()`(쿠키 무관 anon 클라이언트)를 추출·export. `unstable_cache` 안에서 공유 사용하기 위함.
- `lib/menu-data.ts` (수정): 로컬 `publicClient` 정의·`createClient`/`Database` import 제거하고 `./supabase/public`에서 import. 동작 동일(중복 제거).
- `lib/boards.ts` (신규): 공개 게시판 데이터 페처 2종.
  - `getBoardMeta(slug)`: `boards` 메타를 `unstable_cache`(`["board-meta", slug]`, `revalidate: 600`, `tags: ["menu", board:${slug}]`)로 캐시. `maybeSingle()` 사용(없으면 null).
  - `getPublicBoardList(slug, page, pageSize)`: 공지(상위 5)+목록(range, `count: exact`)을 `page.tsx`와 동일한 select/정렬로 옮겨 `unstable_cache`(`["board-list", slug, page]`, `revalidate: 60`, `tags: [board:${slug}]`)로 캐시. 검색(`q`) 분기는 포함하지 않음. `{ notices, posts, count }` 반환.
- `app/boards/[slug]/page.tsx` (수정): 데이터 출처 분기 추가.
  - `board` 조회를 `getBoardMeta`(캐시)로, `profile`은 `getSessionProfile()`(동적)로 분리해 `Promise.all`.
  - 권한 통과 후: **공개(`read_roles === null`) && 검색어 없음** → `getPublicBoardList`(캐시 경로). **그 외(게이트 또는 `?q=`)** → 기존 `createClient()`(쿠키/RLS) 목록·공지 쿼리 그대로(동적 경로). 렌더(rows/테이블/카드/페이징/공지/FAB)는 변경 없음.
- `app/boards/[slug]/actions.ts` (수정): `revalidateTag` import 추가. `createPost`/`updatePost`/`deletePost` 성공 경로에 `revalidateTag(board:${slug})` 추가(기존 `revalidatePath` 유지). `createComment`/`deleteComment`는 미추가(목록 60초 TTL로 댓글 카운트 수렴 — spec 범위 제외 준수).

## 핵심 결정

- **spec을 그대로 따름.** 캐싱 대상은 공개 게시판 목록으로 한정, 게이트 게시판·검색·본문 페이지는 동적 유지. 앱 레벨 권한 분기 신규 추가 없음(기존 `canReadBoard`는 UI 노출용 그대로, 실제 차단은 RLS — CLAUDE.md 원칙 3).
- **타입 통합 방식(spec에 미명시, 구현 판단):** `page.tsx`의 두 데이터 경로가 동일 select 문자열을 쓰므로 `type ListData = Awaited<ReturnType<typeof getPublicBoardList>>`로 공통 타입을 잡고 `notices`/`posts`/`count`를 `let`으로 분기 대입. 캐시 경로와 동적 경로의 PostgREST 추론 타입이 일치해 캐스팅 없이 양쪽 대입 가능.
- **`getBoardMeta`는 anon 캐시지만 안전:** `boards_select`가 `using(true)`라 anon이 게시판 메타(이름/역할/구성)를 읽는 건 기존 메뉴 렌더(`getMenuData`)와 동일하게 공개 데이터. **게이트 게시판의 글(posts) 데이터는 anon 캐시로 흐르지 않음** — 게이트/검색은 동적 RLS 경로에서만 `posts`를 조회한다.
- `force-dynamic`은 유지(회귀 표면 최소화). 데이터 함수 단위 `unstable_cache`는 라우트 렌더 모드와 무관하게 동작.
- `board` 조회를 권한 체크 뒤가 아니라 그대로 상단에서 수행하되, 무거운 목록 페치는 권한 통과 후로 이동 → 차단 사용자에 대한 불필요한 목록 쿼리 제거(부수적 개선).

## 검증 방법

- **타입/빌드:** `npm run build`(+ `npm run lint`). ⚠️ 이 환경에서는 `npm`/`npx`/`tsc`/`eslint`가 권한 허용 목록에 없어 implementer가 로컬 실행하지 못했다. 리뷰어/워처가 빌드를 실행해 통과를 확인해 주세요. (타입 정합성은 정적 검토로 확인: 두 경로가 동일 select라 `ListData` 공통 타입에 무캐스팅 대입 가능.)
- **캐시 동작:** 공개 게시판(예: 공지/학교소식, `read_roles is null`)을 검색어 없이 2회 열면 1회차만 Supabase 목록/공지 쿼리가 나가고 2회차는 캐시 히트(서버 로그/네트워크로 왕복 감소 확인).
- **무효화:** 공개 게시판에서 글 작성 → 다른 사용자 목록에 즉시 노출. 제목 수정/삭제 → 목록·본문 즉시 반영(`revalidateTag`).
- **회귀:** 게이트 게시판 열람 시 권한 차단(AccessNotice)·표시 결과 동일. 공개 게시판 `?q=` 검색 결과·페이징 동일.

## 리뷰 포인트

- **Supabase 리전 점검(AC 미충족 항목, 사람 플래그 필요):** CLAUDE.md 원칙 7상 Supabase 프로젝트 리전이 `ap-northeast-2`(Seoul)여야 Vercel `icn1`과 일치한다. 이는 **대시보드 확인 사항이며 implementer가 접근할 수 없다(코드 산출물 아님)**. `vercel.json`은 `["icn1"]` 유지 확인. → 운영자/워처가 Supabase 대시보드에서 리전이 `ap-northeast-2`인지 확인 부탁드립니다. 불일치 시 함수↔DB 리전 불일치(전 페이지 +1s 지연)가 캐시 미스 경로(게이트/검색/본문)에 남으므로 리전 마이그레이션 또는 read replica는 별도 인프라 작업으로 처리.
- **성능 검증(AC 마지막 항목):** 실측(Slow 4G + CPU 4x, 중앙값 of 3, 캐시 워밍 후)은 배포/프리뷰 환경이 필요해 로컬에서 수행하지 못했다. 캐시 히트 시 공개 게시판 목록의 Supabase 왕복이 제거되므로 기존(~1.2s) 이하가 기대값. 리전 불일치가 남으면 미달 가능 — 위 리전 점검과 함께 확인 필요.
- `unstable_cache` 키 구성(`["board-list", slug, String(page)]`)이 페이지별로 분리되는지, `tags`로 무효화가 전 페이지에 걸리는지 확인(같은 태그 `board:${slug}`라 글 변경 시 모든 페이지 캐시 무효화 — 의도된 동작).
- 댓글 작성 시 목록의 댓글 카운트는 60초 TTL로만 수렴(즉시 반영 아님). spec 범위 제외이며 즉시성 필요 시 별도 이슈.
