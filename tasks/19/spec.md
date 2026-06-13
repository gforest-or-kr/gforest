# spec: 게시판 동적 페이지가 기존 사이트보다 느림 — Supabase 쿼리 응답 개선 (#19)

## 요약

게시판 목록(`app/boards/[slug]/page.tsx`)·본문(`app/boards/[slug]/[postId]/page.tsx`)이 둘 다
`export const dynamic = "force-dynamic"`라서 **매 요청 Supabase 왕복**을 돈다. TTFB는 엣지라 빠르지만
실데이터(서버 컴포넌트의 Supabase 쿼리 결과)가 늦게 나타나는 게 병목이다.

병목 제거의 핵심 레버는 **데이터 캐싱(이슈 방향 1)** 이다. 권한 모델상 `can_read_board`는 게시판 단위
전부-또는-전무이므로, **공개 게시판(`read_roles is null`)의 목록 데이터는 모든 사용자에게 동일**하고
anon 클라이언트로도 RLS가 전체 데이터를 정확히 반환한다(`lib/menu-data.ts`의 `getMenuData`가 이미 쓰는
패턴). 따라서 공개 게시판 목록을 `unstable_cache`로 캐시하고 글 작성/수정/삭제 시 `revalidateTag`로
무효화하면, 고트래픽 공개 게시판(공지·학교소식)의 매 요청 왕복을 제거할 수 있다.

쿼리 최적화(방향 2)는 코드가 이미 필요한 컬럼만 select하고 인덱스도 존재해 여지가 작다(아래 "범위 제외").
리전 일치(방향 3)는 인프라 점검 항목이며 코드 변경이 아니다 — 검증·문서화로 처리하고, 불일치 시
사람에게 보고한다(implementer는 코드만 다룬다).

## 보수적 해석 (이슈의 "planner가 구체화" 항목 처리)

역할 지침상 범위가 가장 작은 해석을 택하고 명시한다.

- **캐싱 대상은 공개 게시판 목록으로 한정한다.** 권한 게이트 게시판(`read_roles`가 non-null)은 현재
  RLS 기반 동적 경로를 그대로 유지한다. 이유: ① CLAUDE.md 원칙 3(권한은 DB가 강제, 앱에 권한 분기
  중복 금지) — 게이트 게시판을 service-role로 캐시하면 앱의 `canReadBoard`가 유일한 보호막이 되어
  원칙 위반. ② 게이트 게시판은 RLS 자체가 anon 캐시에서 빈 결과를 주므로 캐시해도 의미 없음(데이터
  유출 위험은 없으나 UX가 깨짐 → 캐시 제외). ③ 벤치마크가 측정한 고트래픽 게시판은 공개 게시판이다.
- **검색 결과(`?q=`)는 캐시하지 않는다.** 키스페이스가 무한해 캐시 키가 폭증하므로, 검색은 기존 동적
  경로로 폴백한다.
- **게시글 본문 페이지는 캐시하지 않는다.** 매 로드마다 `increment_view_count` RPC로 쓰기가 발생해
  캐싱과 상충하고(조회수 stale 또는 캐시 무효화 비용), 본문은 글당 트래픽이 낮다. 이슈의 측정 목표
  (Acceptance)도 "게시판 목록"만 임계값을 제시한다. 본문은 동적 유지 + 리전/인덱스 개선으로 커버.
- **리전 변경 자체는 코드 산출물이 아니다.** implementer는 점검 결과를 PR 설명/문서에 남기고, 불일치면
  spec의 AC를 통해 사람에게 플래그한다(watcher가 보고). Supabase 프로젝트 리전 마이그레이션은 인프라 작업.

## 구현 계획

### 1. `lib/supabase/public.ts` (신규) — anon 공개 클라이언트 공유

현재 `lib/menu-data.ts` 안에 비공개 `publicClient()`가 있다. 캐시 함수가 공유하도록 추출한다.

```ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// 공개 데이터 전용 클라이언트 (쿠키 무관) — unstable_cache 안에서 사용 가능
export function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
```

`lib/menu-data.ts`는 이 모듈에서 `publicClient`를 import하도록 수정(로컬 정의 제거). 동작 동일.

### 2. `lib/boards.ts` (신규) — 캐시된 게시판 데이터 페처

`getMenuData`와 동일한 `unstable_cache` 패턴. **쿠키/세션을 읽지 않는다**(unstable_cache 제약).

- `getBoardMeta(slug)`:
  - `publicClient().from("boards").select("*").eq("slug", slug).eq("is_active", true).maybeSingle()`.
  - `boards_select`는 `using(true)`라 anon이 모든 board 행을 읽음 — 안전(게시판 메타는 공개 메뉴용).
  - `unstable_cache(..., ["board-meta", slug], { revalidate: 600, tags: ["menu", `board:${slug}`] })`.
    (게시판 구성 변경은 드묾. `menu` 태그로 admin 게시판 편집과도 연동.)
- `getPublicBoardList(slug, page, pageSize)`:
  - 현재 `page.tsx`의 목록 쿼리·공지 쿼리를 그대로 옮긴다(컬럼·정렬·range·count 동일). **단 검색(`q`)
    분기는 포함하지 않는다**(검색은 호출부에서 캐시 우회).
  - 반환: `{ notices, posts, count }`.
  - `unstable_cache(..., ["board-list", slug, String(page)], { revalidate: 60, tags: [`board:${slug}`] })`.
    (글 작성/수정/삭제 시 `revalidateTag(`board:${slug}`)`로 즉시 무효화하므로 revalidate는 백업 TTL.)
  - 호출부에서 **공개 게시판일 때만**(아래) 호출하므로 anon RLS가 전체 데이터를 정확히 반환한다.

### 3. `app/boards/[slug]/page.tsx` (수정) — 캐시/동적 경로 분기

목표: 비용이 큰 목록 데이터 페치를 공개·비검색 경로에서 캐시 히트로 전환. 개인화(profile/canWrite)는
동적 유지(쿠키를 읽으므로 라우트는 어차피 동적 렌더). `force-dynamic`은 데이터 함수 단위 캐싱과 무관하니
유지해도 무방(굳이 제거하지 않음 — 회귀 표면 최소화).

흐름:

1. `const profile = await getSessionProfile();` — 개인화용(기존과 동일, 동적).
2. `const board = await getBoardMeta(slug);` — 캐시. 없으면 `notFound()`.
3. `if (!canReadBoard(board.read_roles, role)) → AccessNotice` (기존 로직 유지).
4. 데이터 분기:
   - **공개(`board.read_roles == null`) && 검색어 없음(`!q`)** → `const { notices, posts, count } =
     await getPublicBoardList(slug, page, PAGE_SIZE);` (캐시 경로).
   - **그 외(게이트 게시판 또는 검색)** → 기존 `createClient()`(쿠키/RLS) 기반 목록·공지 쿼리를 그대로
     실행(동적 경로). 즉 현재 `Promise.all` 블록을 이 분기 안으로 옮긴다.
5. 이후 렌더(rows 매핑, 테이블/카드/페이징/공지/FAB)는 **변경 없음** — 데이터 출처만 분기된다.

주의: `board` 조회를 캐시 함수로 옮기므로 기존 `Promise.all` 안의 `boards` 쿼리는 제거된다. 게이트/검색
동적 경로에서는 `getBoardMeta`로 이미 board를 확보했으므로 board 재조회 불필요(목록 쿼리만 동적 실행).

### 4. `app/boards/[slug]/actions.ts` (수정) — 캐시 무효화 연동

`next/cache`에서 `revalidateTag`를 추가 import. 글 작성/수정/삭제가 목록 캐시를 무효화하도록 한다.
기존 `revalidatePath` 호출은 유지(무해)하고 다음을 **추가**한다:

- `createPost`: 성공 후 `revalidateTag(`board:${slug}`)`.
- `updatePost`: 성공 후 `revalidateTag(`board:${slug}`)`.
- `deletePost`: 성공 후 `revalidateTag(`board:${slug}`)`.
- (`createComment`/`deleteComment`는 본문 페이지만 갱신 — 목록 캐시 무효화 불필요. 다만 목록의 댓글
  카운트가 캐시로 stale될 수 있음. 보수적으로 `getPublicBoardList`의 `revalidate: 60` TTL이 이를
  수렴시키므로 추가 무효화는 하지 않는다. 댓글 작성 시 목록 카운트 즉시 반영이 필요하면 별도 이슈.)

### 5. 리전 일치 점검 (방향 3 — 코드 아님, 검증·문서)

- Supabase 프로젝트 리전이 `ap-northeast-2`(Seoul)인지 대시보드에서 확인한다(CLAUDE.md 원칙 7: Vercel
  `icn1`과 일치해야 함). `vercel.json`은 이미 `["icn1"]` — 유지(제거 금지).
- 일치하면 PR 설명/`tasks/19/handoff.md`에 "Supabase 리전 = ap-northeast-2 확인" 기록.
- **불일치면** 코드로 해결 불가 → handoff에 명시하고 AC를 통해 사람에게 플래그(리전 마이그레이션 또는
  read replica 검토는 인프라 작업). 이 경우에도 1·2·4의 캐싱 코드는 그대로 가치가 있다.

## Acceptance Criteria

- [ ] `lib/supabase/public.ts`가 신규 생성되어 `publicClient`를 export하고, `lib/menu-data.ts`가 이를
      import한다(로컬 `publicClient` 정의 중복 없음). 메뉴 렌더링 회귀 없음.
- [ ] `lib/boards.ts`에 `getBoardMeta`·`getPublicBoardList`가 `unstable_cache`로 감싸여 있고, 쿠키/헤더를
      읽지 않으며(`createClient`(server) 미사용), 각각 `board:${slug}` 태그를 포함한다.
- [ ] 공개 게시판(`read_roles is null`)을 검색어 없이 열면 목록 데이터가 `getPublicBoardList`(캐시) 경로로
      렌더된다. 동일 게시판 2회차 요청은 Supabase 목록/공지 쿼리 왕복 없이 캐시에서 제공된다.
- [ ] 권한 게이트 게시판 또는 검색(`?q=`) 요청은 기존 RLS 동적 경로로 폴백하며, 표시 결과·권한 차단
      (AccessNotice)·검색 결과가 기존과 동일하다(회귀 없음).
- [ ] 공개 게시판에서 글을 **작성**하면 작성자 본인 외 사용자의 목록에도 새 글이 즉시 나타난다
      (`revalidateTag`로 캐시 무효화 — stale 없음).
- [ ] 공개 게시판 글을 **수정/삭제**하면 목록·본문에 변경이 즉시 반영된다(제목 변경/삭제 글 사라짐).
- [ ] `app/boards/[slug]/actions.ts`의 `createPost`/`updatePost`/`deletePost`가 성공 경로에서
      `revalidateTag(`board:${slug}`)`를 호출한다.
- [ ] `app/boards/[slug]/page.tsx`에 앱 레벨 권한 분기가 새로 추가되지 않았다(기존 `canReadBoard`는
      UI 노출용 그대로, 실제 차단은 RLS — CLAUDE.md 원칙 3 유지). 게이트 게시판 데이터는 anon 캐시로
      흘러가지 않는다.
- [ ] `vercel.json`의 `regions: ["icn1"]`이 유지되어 있다(제거 금지).
- [ ] Supabase 프로젝트 리전 점검 결과가 `tasks/19/handoff.md` 또는 PR 설명에 기록되어 있다
      (일치 = ap-northeast-2 확인 / 불일치 = 인프라 플래그).
- [ ] `npm run build`(+ lint/tsc)가 신규·수정 파일에서 타입·린트 오류 없이 통과한다.
- [ ] **(성능 검증, 인프라 정상 전제)** 동일 throttle 조건(Slow 4G + CPU 4x, 중앙값 of 3)에서 공개
      게시판 목록의 실데이터 출현 시간이 기존(약 1.2s) 이하로 단축된다(2회차 이후 캐시 워밍 상태 기준).
      리전 불일치 등 인프라 요인이 남아 목표 미달이면 그 사유를 handoff에 기록한다.

## 범위 제외

- **게시글 본문 페이지 캐싱**: `increment_view_count` 쓰기와 상충, 글당 저트래픽 → 동적 유지.
- **권한 게이트 게시판 캐싱**: RLS 강제 원칙 보존을 위해 캐시하지 않음(동적 RLS 경로 유지).
- **검색 결과 캐싱**: 캐시 키 폭증 방지 위해 동적 경로 유지.
- **쿼리 컬럼 추가 최적화**: 목록/공지 쿼리는 이미 필요한 컬럼만 select하고
  `posts_board_created_idx`(board_id, created_at desc)·`comments_post_idx`·`attachments_post_idx`가
  이미 존재 → 추가 인덱스/컬럼 트리밍 불필요. 단, 본문 검색 `ilike '%q%'`는 선두 와일드카드라 seq scan
  이지만 학부모조합 규모에서 허용 가능 — pg_trgm GIN 인덱스 도입은 별도 이슈(스키마 변경 동반).
- **`count: "exact"` 변경**: count는 동일 PostgREST 요청의 Content-Range로 반환되어 추가 왕복이 아니며,
  소규모 게시판에서 비용이 작고 페이지네이션 UI가 정확한 총 페이지 수를 필요로 함 → 유지.
- **`getSessionProfile` 캐싱**: 사용자별 캐시 + 역할 변경 무효화 복잡도 대비 이득 작음(로컬 JWT 검증 +
  단일 profile 쿼리). 별도 이슈.
- **댓글 작성 시 목록 카운트 즉시 반영**: `getPublicBoardList`의 60초 TTL로 수렴 → 즉시성 필요 시 별도 이슈.
- **Supabase 리전 마이그레이션/ read replica 도입**: 코드 산출물 아님(인프라). 불일치 시 사람에게 보고.
- **스키마/마이그레이션/타입 변경**: 본 이슈는 캐싱·페치 경로 변경만 — `supabase/migrations/*`,
  `lib/supabase/types.ts` 변경 없음.
