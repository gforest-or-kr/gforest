# 렌더링 · 캐시 전략 (현행, 2026-09)

> 서버 컴포넌트가 무엇을 읽어도 되고, 무엇을 캐시하며, 언제 무효화하는가. 원칙은 `CLAUDE.md` 기술 원칙 9,
> 코드 작성법은 `docs/conventions/code-patterns.md` §3·§4·§6. 여기는 그 근거와 태그 표.

## 1. 기본 — 서버 렌더 + 공개 데이터 태그 캐시

- 앱은 ECS Fargate 에서 **상시 실행되는 서버**다. 세션(`getSessionProfile()`/`getSessionUserId()`)을 layout·페이지·서버 액션
  어디서 읽어도 된다 — 그 페이지가 동적 렌더가 될 뿐이고, 그것이 기본이다. `Header` 는 서버에서 세션을 읽어 `HeaderNav` 에 props 로 넘긴다.
- **회원 게시판은 사용자 RLS 컨텍스트로 서버 렌더**: `withUser(userId, …)` 트랜잭션이 `app.user_id` 를 주입하고 DB 의 RLS 가 권한을 판정한다.
  캐시하지 않는다(사용자마다 결과가 다르고, 인증 콘텐츠를 공유 캐시에 담지 않는다).
- **공개 데이터만 캐시**한다: `lib/menu-data.ts`·`lib/boards.ts` 의 `unstable_cache` 페처. 이 페처들은 **`withUser(null, …)`(anon) 로만** 조회한다.
  공개 게시판(`read_roles is null`)은 anon RLS 가 전체를 정확히 돌려주므로 모든 사용자에게 같은 결과다.
- **`unstable_cache` 콜백 안에서 세션·쿠키를 읽지 않는다.** 읽는 순간 한 사용자의 결과가 다른 사용자에게 캐시로 새어 나가거나,
  캐시 자체가 무효가 된다. 세션이 필요하면 캐시 밖(페이지·액션)에서 읽어 인자로 넘기지 말고, 회원 페처(`getMemberPostDetail`·`getBoardListForUser`)를 쓴다.
- **클라이언트 컴포넌트는 DB·세션에 직접 접근하지 않는다.** 데이터는 props, 변경은 서버 액션 → `router.refresh()`.
- **빌드는 DB 를 건드리지 않는다.** `generateStaticParams`·정적 라우트에서 쿼리 금지. CI `ci` 잡은 `DATABASE_URL` 없이 `next build` 한다.

## 2. 캐시 태그

| 페처 | TTL(백업) | 태그 | 무효화 지점 |
|---|---|---|---|
| `getMenuData()` (`lib/menu-data.ts`) | 600s | `menu` | 관리자 게시판 설정 변경 — `app/(site)/admin/boards/actions.ts` |
| `getBoardMeta(slug)` | 600s | `menu`, `board:<slug>` | 위와 동일 + 아래 `board:<slug>` |
| `getPublicBoardSlugs()` | 600s | `menu` | 위와 동일 |
| `getPublicBoardList(slug, page, size)` | 60s | `board:<slug>` | 글 작성·수정·삭제 — `app/(site)/boards/[slug]/actions.ts` |
| `getCalendarEvents(slug)` | 300s | `board:<slug>` | 동일 |
| `getPostDetail(slug, postId)` (공개 글) | 300s | `post:<id>`, `board:<slug>` | 글 수정·삭제, 댓글 작성·수정·삭제 — 같은 파일 |

- 무효화는 서버 액션에서 `revalidateTag(tag, "max")` — Next 16 은 두 번째 인자가 필수다. 같은 액션에서 `revalidatePath` 도 함께 호출해 라우트 캐시를 비운다.
- TTL 은 태그 무효화가 놓쳤을 때의 백업이다. 글 상세 300s 는 첨부 서명 URL(1h) 보다 짧게 유지한다.
- 캐시는 프로세스 내 저장이라 태스크가 2개(prod)면 각각이다 — 무효화는 요청이 닿은 태스크에 즉시, 나머지는 TTL 로 수렴한다. TTL 을 길게 늘리지 말 것.
- `unstable_cache` 는 Next 가 `"use cache"` 로 대체 중인 과도기 API다. 사용처가 `lib/boards.ts`·`lib/menu-data.ts` 두 곳뿐이라 이전은 국소적이지만, **Next 메이저 업그레이드 때 가장 먼저 깨질 지점**이다.

## 3. 확인 방법

- 로컬 `next build` 가 DB 없이 통과하는지. 라우트 표에서 게시판·글 상세가 `ƒ`(동적) 인지 본다.
- 병합 후 dev(`https://dev.gforest.or.kr`) 에서 공개 글·회원 글(로그인)·비로그인 회원 글(안내 화면)·글 작성 뒤 목록 즉시 반영을 눈으로 확인한다.

## 4. 이력

2026-06~08 프로토타입(서버리스 호스팅 + 증분 정적 재생성 시절)은 정적 셸 + 클라이언트 개인화 구조였다. layout 안의 서버 컴포넌트가 쿠키를 읽으면
빌드·dev 는 통과하고 프로덕션에서만 `DYNAMIC_SERVER_USAGE` 500 이 나는 함정이 있었고, 그 대응으로 클라이언트 세션 로더·스모크 게이트가
붙어 있었다. 2026-09 상시 구동 ECS 로 옮기면서 그 제약과 장치가 모두 사라졌고 현행 정책은 §1 이 전부다. 당시 기록은 Confluence
**03 설계** 에만 있다(repo 사본 없음).
