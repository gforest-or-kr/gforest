# spec: 게시글 삭제가 동작하지 않음 — 버튼 클릭해도 글이 남고 에러 표시 없음 (#5)

## 요약

본인 글 상세에서 **삭제**를 누르면 글이 지워지지 않은 채 목록으로 이동하고, 실패 피드백도 없다.
원인은 RLS 정책 누락이 아니라 **애플리케이션 계층의 결과 미확인**이다. `deletePost` 서버 액션
(`app/boards/[slug]/actions.ts:71-80`)이 다음 세 가지 문제를 가진다.

1. **세션 검증 누락**: `createPost`/`createComment`는 작업 전 `supabase.auth.getUser()`로 세션을
   검증·갱신하지만 `deletePost`는 이 단계 없이 곧장 `update`를 호출한다. `@supabase/ssr` 클라이언트는
   쿠키의 토큰을 PostgREST 요청에 그대로 싣는데, 토큰이 만료/미갱신 상태면 RLS
   `posts_update using (author_id = auth.uid() or is_admin())`에서 `auth.uid()`가 null이 되어
   **0행 갱신·에러 없음**(Supabase의 조용한 RLS no-op)으로 끝난다.
2. **결과 미확인**: `update`의 반환 `error`와 **영향받은 행 수**를 모두 무시한다.
3. **무조건 리다이렉트**: 성공 여부와 무관하게 `redirect(목록)`을 호출해 항상 성공처럼 보인다.

추가로 **삭제 전 확인(confirm) 단계가 없다**(버튼이 일반 `<form>` 서버 액션 제출).

소프트 삭제가 실제로 반영되기만 하면 목록 쿼리(`app/boards/[slug]/page.tsx:37`)와 상세 쿼리
(`app/boards/[slug]/[postId]/page.tsx:27`, `.single()`→`notFound()`)가 모두 `deleted_at is null`을
필터하므로, 목록 제거·직접 URL 404는 **기존 코드로 이미 충족**된다. 즉 성공 경로는 정상이고
실패 경로(미반영·무피드백)와 확인 단계만 고치면 된다.

**RLS 마이그레이션 변경은 불필요하다.** `posts_update` 정책이 본인 소프트 삭제(UPDATE)를 이미 허용한다
(`supabase/migrations/00000000000001_initial_schema.sql:293-294`). 이슈 본문의 "delete 정책 누락" 추정은
삭제가 DELETE가 아니라 `deleted_at` UPDATE로 구현된다는 점에서 빗나간 진단이다. `posts_delete`(admin 전용
하드 삭제) 정책도 그대로 둔다.

## 구현 계획

### 1. `app/boards/[slug]/actions.ts` — `deletePost` 재작성

`createPost`의 패턴을 따라 세션 검증을 추가하고, 결과를 확인한 뒤에만 목록으로 이동한다. 권한 분기는
DB(RLS)에 맡기고(코드에 권한 로직 중복 금지 — CLAUDE.md 원칙 3) **결과만** 판정한다.

- 함수 시작에서 `const { data: { user } } = await supabase.auth.getUser();` 호출, `!user`면
  `redirect('/login?returnTo=' + encodeURIComponent('/boards/' + slug + '/' + postId))`.
- 소프트 삭제 UPDATE를 **영향 행 수를 알 수 있게** 호출한다. 반환 데이터로 성공을 판정하지 말 것
  — 소프트 삭제된 행은 `posts_select`(`deleted_at is null`)를 통과하지 못해 `.select()`는 성공해도
  0행을 돌려준다. 대신 `count`로 판정한다:
  ```ts
  const { error, count } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", postId)
    .is("deleted_at", null);   // 멱등성: 이미 삭제된 글 재삭제 방지
  ```
- **실패 처리**: `error || !count`(0행)이면 목록으로 가지 말고
  `redirect('/boards/' + slug + '/' + postId + '?error=' + encodeURIComponent('삭제에 실패했습니다. 권한을 확인해 주세요'))`.
- **성공 처리**: `revalidatePath('/boards/' + slug)` 및 `revalidatePath('/boards/' + slug + '/' + postId)`
  후 `redirect('/boards/' + slug)`.
- `redirect()`는 내부적으로 예외를 던지므로 `try/catch`로 감싸지 말 것(감싸면 리다이렉트가 삼켜진다).

### 2. 확인 대화상자 — 신규 클라이언트 컴포넌트

`app/boards/[slug]/[postId]/delete-post-button.tsx` (client component, `"use client"`)를 새로 만든다.

- props로 바인딩된 서버 액션(`action: () => Promise<void>`)을 받는다(서버 액션을 클라이언트 컴포넌트에
  prop으로 전달하는 것은 Next.js App Router에서 허용됨).
- `<form action={action} onSubmit={...}>` 형태로, `onSubmit`에서 `confirm("이 글을 삭제하시겠습니까? 되돌릴 수 없습니다.")`가
  false면 `e.preventDefault()`로 제출을 막는다.
- 버튼 마크업/클래스는 기존(`page.tsx:103`)과 동일하게 유지(`삭제`, `text-slate-400 hover:text-red-500 px-2 py-1`).

### 3. `app/boards/[slug]/[postId]/page.tsx` — 버튼 교체 + 에러 배너

- 신규 컴포넌트 import 후, 기존 inline `<form action={deletePostAction}>…</form>`(101-105행)을
  `{(isAuthor || isAdmin) && <DeletePostButton action={deletePostAction} />}`로 교체.
  `deletePostAction` 바인딩(92행)은 그대로 재사용.
- 컴포넌트가 `searchParams`를 받도록 시그니처를 확장
  (`{ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ error?: string }> }`)하고,
  `const { error } = await searchParams;` 후 `error`가 있으면 본문 상단에 에러 배너를 렌더(예: 빨간 톤
  `rounded-xl bg-red-50 text-red-600 text-sm px-3 py-2`). 삭제 실패 시 이 경로로 돌아와 사용자에게 노출된다.

### 4. 검증용 테스트 글 정리

이슈에 명시된 검증 글 `/boards/free/edb45a73-4192-4059-8f2f-9c81a3449ca1`(`[동작검증] 자동 테스트 글입니다`,
댓글 1개)을 **수정 후 → 삭제** 시나리오의 검증 대상으로 사용하고, 수정된 삭제 플로우가 정상 동작함을
확인한 뒤 최종적으로 이 글을 삭제해 제거한다(런타임 검증 단계). 댓글은 소프트 삭제 설계상 글이 보이지
않으면 함께 비노출되므로 별도 처리 불필요.

## Acceptance Criteria

- [ ] 본인 글 상세에서 삭제 클릭 시 **확인 대화상자(confirm)** 가 먼저 뜬다.
- [ ] 확인을 취소하면 글이 삭제되지 않고 상세 페이지에 그대로 머문다(네트워크/액션 호출 없음).
- [ ] 확인 후 삭제가 성공하면 목록에서 해당 글이 사라지고, 직접 URL(`/boards/free/<id>`) 접근 시
      `notFound()`(404 안내 페이지)가 뜬다.
- [ ] 삭제가 실패하면 목록으로 이동하지 않고, 사용자에게 에러 메시지가 화면에 표시된다.
- [ ] `deletePost`가 `update` 결과의 `error`와 영향 행 수(`count`)를 확인하며, 둘 중 하나라도 실패면
      목록 `redirect`를 수행하지 않는다(코드 검토로 확인 가능).
- [ ] `deletePost`가 `update` 이전에 `auth.getUser()`로 세션을 검증하고 비로그인 시 로그인으로
      리다이렉트한다.
- [ ] 성공 판정을 `.select()` 반환 데이터가 아니라 `count`(또는 동등한 영향 행 수)로 한다
      — 소프트 삭제 행이 `posts_select`를 통과하지 못하는 점을 반영.
- [ ] `supabase/migrations/` 및 기존 RLS 정책에 **변경이 없다**(이번 수정은 앱 코드 한정).
- [ ] `npm run build`(또는 프로젝트 표준 타입체크/린트)가 통과한다.
- [ ] 검증 글 `edb45a73-4192-4059-8f2f-9c81a3449ca1`이 수정된 플로우로 삭제되어 자유게시판 목록과
      직접 URL에서 더 이상 접근되지 않는다(런타임 환경에서 확인).

## 범위 제외

- RLS 정책/마이그레이션 변경(현행 `posts_update`가 본인 소프트 삭제를 이미 허용 — 변경 금지).
- 하드 삭제로의 전환, `posts_delete`(admin 전용) 정책 수정.
- 댓글 소프트 삭제 cascade 동작 변경(현행 유지).
- 첨부파일 Storage 객체 정리(소프트 삭제 시 파일 보존은 별도 이슈).
- 토스트/모달 등 별도 알림 라이브러리 도입(에러는 기존 패턴인 `?error=` 쿼리 + 인라인 배너로 표시).
- `createComment`/`deleteComment`/`createPost` 등 다른 액션의 동작 변경(`deleteComment`도 유사한
  결과 미확인 문제가 있으나 이번 이슈 범위 밖).
