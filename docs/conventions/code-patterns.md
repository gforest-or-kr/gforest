# 코드 규칙 · 패턴

> 코드를 추가/수정할 때 따르는 패턴. 원칙의 "왜"는 `CLAUDE.md`, 렌더링의 깊은 배경은
> `docs/design/rendering.md`. 여기는 **실제 코드를 어디에 어떻게 쓰는가**.

## 1. 권한 — RLS가 단일 진실

- 게시판 33개의 읽기/쓰기 권한은 `boards.read_roles[] / write_roles[]` **데이터** + RLS 함수
  `can_read_board()` / `can_write_board()`(SECURITY DEFINER)로 강제된다. `read_roles is null` = 익명 공개.
- **앱 코드의 권한 검사(`lib/menu.ts`의 `canReadBoard` 등)는 UI 노출 제어용일 뿐, 게이트가 아니다.**
  같은 판단을 앱에 중복 구현하지 말 것 — 쿼리가 RLS로 이미 걸러진다(권한 없으면 빈 결과/거부).
- 역할: `pending → member / operator / teacher / student / admin` (선형 계층 아님). 역할 변경은
  admin 전용이며 트리거(`guard_role_change`)가 차단·감사한다.

## 2. DB 변경 — 마이그레이션으로만

- `supabase/migrations/*.sql`이 단일 진실(폴더명은 역사적). **콘솔 수동 변경 금지.** 새 변경은 새 번호 마이그레이션 파일.
- 적용은 `infra/db/bootstrap.sh <env>`(미적용분만 순차 적용, `public.schema_migrations` 추적). 변경 후 `lib/db/types.ts`의 Row 타입을 손으로 맞춘다.
- Supabase 전용 객체(`storage.*`, `auth.jwt()`)는 새 마이그레이션에 쓰지 않는다. RLS는 `auth.uid()`만 참조 — RDS에서는 `set_config('app.user_id')`를 읽는 셔임이다.
- 게시판 추가/변경은 **코드가 아니라 `supabase/seed.sql`의 데이터**로 해결한다(템플릿 5종 공유).
- **`legacy_*` 컬럼(unique)은 XE ETL 멱등성의 키 — 삭제·변경 금지.**

## 3. 데이터 접근 — `withUser()` 트랜잭션 + RLS

```ts
import { withUser, one, many, pgCode } from "@/lib/db";
const userId = await getSessionUserId();           // null이면 anon
const rows = await withUser(userId, (c) => many<Row>(c, "select … where board_id = $1", [boardId]));
```

- **모든 쿼리는 `withUser(userId | null, fn)` 안에서** 실행한다. 트랜잭션마다 `app.user_id`가 설정되어 DB의 `auth.uid()`·RLS가 Supabase 때와 동일하게 동작한다. 밖에서 `pool.query`를 직접 쓰는 곳은 인증(`lib/auth*.ts`)뿐.
- RLS 거부는 **0행 또는 42501**로 온다. update/delete는 `rowCount`를 확인하고, 소프트삭제처럼 결과 행이 select에서 사라지는 경우는 재조회로 확인한다(`app/(site)/boards/[slug]/actions.ts` 패턴). unique 충돌은 `pgCode(e) === "23505"`.
- 파라미터 쿼리(`$1…`)만. 문자열 조립 금지. ilike 검색어는 `%`·`_`를 이스케이프.
- 세션: `getSessionUserId()` / `getSessionProfile()`(`lib/auth.ts`, 요청 단위 메모이즈). 서버 컴포넌트·layout·서버 액션 어디서나 호출 가능.
- **`unstable_cache` 콜백 안에서는 세션을 읽지 말 것** — 공개 데이터는 `withUser(null, …)`(anon)로만.
- 클라이언트 컴포넌트는 DB·인증에 접근하지 않는다. 데이터는 props로 받고 변경은 서버 액션 호출 → `router.refresh()`.
- 미디어: `lib/storage.ts`(서버 전용) — 첨부는 비공개(`presignGet`/`presignGetMany`, 1h), 아바타·슬라이드는 `publicMediaUrl()`. 업로드는 `createUploadUrl()` → 클라이언트가 presigned PUT.

## 4. 데이터 패칭 · 캐시 · 무효화

| 페처 (`lib/`) | 캐시 | 태그 | 무효화 시점 |
|---|---|---|---|
| `getMenuData()` | 10분 | `menu` | 게시판/권한 변경 시 `revalidateTag('menu', 'max')` |
| `getBoardMeta(slug)` | 10분 | `menu`, `board:slug` | 동일 |
| `getPublicBoardList(slug,page)` | 백업 TTL | `board:slug` | 글 작성/수정/삭제 시 무효화 |
| 글 상세 `getPostDetail`(공개 게시판) | 300초 | `post:id`, `board:slug` | 댓글·수정·삭제 시 무효화. 회원 게시판은 캐시 없이 사용자 컨텍스트로 조회 |

- **무효화는 서버 액션에서 `revalidateTag(tag, "max")`** — Next 16은 두 번째 인자(`"max"`)가 필요하다.
  예: `app/boards/[slug]/actions.ts`의 글 작성 → `revalidateTag('board:'+slug, 'max')`,
  댓글 → `revalidateTag('post:'+postId, 'max')`.
- 글 상세 `revalidate=300`은 첨부 서명 URL(1시간)보다 짧게 둬서 항상 유효하게 한다.

## 5. 서버 액션 패턴

- 폼 제출·변경은 `actions.ts`의 `"use server"` 함수(예: `createPost`/`updatePost`/`deletePost`/댓글).
- 권한은 RLS가 강제 → 액션은 insert/update 결과만 처리(권한 분기 재구현 X). 실패 시 작성 내용 보존.
- 변경 후 관련 `revalidateTag(..., "max")` 호출.

## 6. 렌더링 — 서버 렌더가 기본

- 상시 서버(Fargate)라 세션을 서버에서 읽어도 페이지가 동적이 되는 비용뿐이다. 회원 게시판 글은 사용자 RLS 컨텍스트로 **서버 렌더**(옛 `member-post-loader` 클라 로더는 제거됨).
- 공개 데이터(`lib/boards.ts`·`lib/menu-data.ts`)는 `unstable_cache` + 태그 무효화 유지(§4). `Header`는 서버에서 `getSessionProfile()`로 개인화해 `HeaderNav`에 props로 넘긴다.
- **빌드 시점 DB 접근 금지**(`generateStaticParams` 등) — CI 빌드는 DB 없이 돈다.
- 배경·이력(Vercel ISR 시절의 함정)은 `docs/design/rendering.md`.

## 7. UI · 스타일

- **모바일 퍼스트 단일 반응형** — 별도 모바일 마크업 금지. 탭 타겟 44px+, 호버 의존 금지(드롭다운은
  탭 토글). **다크모드 미지원(확정).**
- 디자인 토큰은 `app/globals.css`의 forest 팔레트. 폰트는 시스템 한글 폰트 스택(웹폰트 전송 0 —
  모바일 저속망 병목 제거).
- 이미지 업로드는 **클라이언트 리사이즈(장변 1600px) 후** — Storage 1GB·egress 5GB/월이 첫 천장.
- 페이지 전환 즉시 피드백을 위해 `loading.tsx`(스켈레톤)를 실제 레이아웃과 위치·높이 맞춰 둔다.

## 8. 커밋 · 검증

- 커밋 메시지에 Jira 이슈 키 포함(`feat: ... (GFM-N)`). 작업 시작/완료 시 Jira 전환(`atlassian.md`).
- 렌더링/데이터패칭 변경 후 로컬 `next build`(DB 없이 통과해야 함) → 병합 후 dev 배포에서 공개 글·회원 글·로그인 확인.
- PR 게이트 `ci`(tsc·eslint·build)가 자동으로 돈다.
