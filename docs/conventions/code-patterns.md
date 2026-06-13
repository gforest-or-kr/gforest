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

- `supabase/migrations/*.sql`이 단일 진실. **대시보드 수동 변경 금지.** 새 변경은 새 번호 마이그레이션 파일.
- 변경 후 `supabase gen types typescript`로 `lib/supabase/types.ts` 재생성.
  (이 환경 함정: 신 CLI는 `--db-url` 모드여도 `SUPABASE_ACCESS_TOKEN`이 없으면 거부 → placeholder
  토큰으로 우회. 직접 호스트는 IPv6 전용이라 실패 → **세션 풀러** 사용.)
- 게시판 추가/변경은 **코드가 아니라 `supabase/seed.sql`의 데이터**로 해결한다(템플릿 5종 공유).
- **`legacy_*` 컬럼(unique)은 XE ETL 멱등성의 키 — 삭제·변경 금지.**

## 3. 렌더링 — 정적 셸 + 클라 개인화 (★ 가장 자주 깨지는 곳)

**layout과 ISR(●) 페이지에서 쿠키를 읽지 말 것.** 어기면 프로덕션에서 `DYNAMIC_SERVER_USAGE` 500
(dev·`next build`는 통과 → 특히 위험). 전체 배경·재현·CI 게이트는 **`docs/design/rendering.md` 필독**.

- 공개 데이터(메뉴·게시판 메타·목록) → `lib/boards.ts` / `lib/menu-data.ts`: `publicClient()`(anon) +
  `unstable_cache`. **쿠키를 안 읽어 캐시·ISR 안전.**
- 세션/개인화(로그인 상태·역할) → `lib/auth.ts`의 `getSessionProfile()`(쿠키 기반). **동적 페이지에서만**
  호출. layout·ISR 페이지에서는 금지 → 클라이언트(`createClient().auth.getClaims()` + `useEffect`)로.
  예: `Header`(서버, 공개 메뉴만) → `HeaderNav`(클라, 세션 개인화).
- 공개 게시판은 `generateStaticParams()`로 프리렌더(prefetch 작동). 권한 게시판은 동적.

## 4. 데이터 패칭 · 캐시 · 무효화

| 페처 (`lib/`) | 캐시 | 태그 | 무효화 시점 |
|---|---|---|---|
| `getMenuData()` | 10분 | `menu` | 게시판/권한 변경 시 `revalidateTag('menu', 'max')` |
| `getBoardMeta(slug)` | 10분 | `menu`, `board:slug` | 동일 |
| `getPublicBoardList(slug,page)` | 백업 TTL | `board:slug` | 글 작성/수정/삭제 시 무효화 |
| 글 상세 (ISR) | `revalidate=300` | `post:id`, `board:slug` | 댓글·수정·삭제 시 무효화 |

- **무효화는 서버 액션에서 `revalidateTag(tag, "max")`** — Next 16은 두 번째 인자(`"max"`)가 필요하다.
  예: `app/boards/[slug]/actions.ts`의 글 작성 → `revalidateTag('board:'+slug, 'max')`,
  댓글 → `revalidateTag('post:'+postId, 'max')`.
- 글 상세 `revalidate=300`은 첨부 서명 URL(1시간)보다 짧게 둬서 항상 유효하게 한다.

## 5. 서버 액션 패턴

- 폼 제출·변경은 `actions.ts`의 `"use server"` 함수(예: `createPost`/`updatePost`/`deletePost`/댓글).
- 권한은 RLS가 강제 → 액션은 insert/update 결과만 처리(권한 분기 재구현 X). 실패 시 작성 내용 보존.
- 변경 후 관련 `revalidateTag(..., "max")` 호출.

## 6. Supabase 클라이언트 4종 — 용도 구분

| 파일 | 용도 |
|---|---|
| `lib/supabase/public.ts` `publicClient()` | anon, 쿠키 무관 → **`unstable_cache` 안에서 안전**(공개 데이터) |
| `lib/supabase/server.ts` `createClient()` | 쿠키 읽음 → **동적 페이지/서버 액션 전용** |
| `lib/supabase/client.ts` | `"use client"` 브라우저용 (`getClaims()`로 로그인 상태) |
| `lib/supabase/middleware.ts` | 미들웨어에서 토큰 리프레시 (`getClaims` 로컬 검증 — Auth 서버 왕복 회피) |

## 7. UI · 스타일

- **모바일 퍼스트 단일 반응형** — 별도 모바일 마크업 금지. 탭 타겟 44px+, 호버 의존 금지(드롭다운은
  탭 토글). **다크모드 미지원(확정).**
- 디자인 토큰은 `app/globals.css`의 forest 팔레트. 폰트는 시스템 한글 폰트 스택(웹폰트 전송 0 —
  모바일 저속망 병목 제거).
- 이미지 업로드는 **클라이언트 리사이즈(장변 1600px) 후** — Storage 1GB·egress 5GB/월이 첫 천장.
- 페이지 전환 즉시 피드백을 위해 `loading.tsx`(스켈레톤)를 실제 레이아웃과 위치·높이 맞춰 둔다.

## 8. 커밋 · 검증

- 커밋 메시지에 Jira 이슈 키 포함(`feat: ... (GFM-N)`). 작업 시작/완료 시 Jira 전환(`atlassian.md`).
- 렌더링/데이터패칭 변경 후 **`bash scripts/isr-smoke.sh`로 글 상세 200 선검증**(배포 CI도 자동 실행).
- 빌드 검증은 `next build` — dev 서버로는 ISR 오류가 안 잡힌다.
