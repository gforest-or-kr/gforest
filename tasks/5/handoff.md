# handoff: #5

## 변경 파일

- `app/boards/[slug]/actions.ts` — `deletePost` 재작성. (1) `auth.getUser()`로 세션
  검증 후 비로그인 시 로그인으로 리다이렉트, (2) 소프트 삭제 UPDATE를 `{ count: "exact" }`로
  호출하고 `.is("deleted_at", null)`로 멱등성 확보, (3) `error || !count`면 목록으로 가지 않고
  상세 `?error=...`로 리다이렉트, 성공 시에만 목록/상세 revalidate 후 목록으로 이동.
- `app/boards/[slug]/[postId]/delete-post-button.tsx` (신규) — `"use client"` 컴포넌트.
  서버 액션을 prop으로 받아 `<form action>`에 바인딩하고 `onSubmit`에서
  `confirm("이 글을 삭제하시겠습니까? 되돌릴 수 없습니다.")` 취소 시 `e.preventDefault()`로 제출 차단.
  버튼 마크업/클래스는 기존과 동일.
- `app/boards/[slug]/[postId]/page.tsx` — 신규 컴포넌트 import, inline `<form>` 삭제 버튼을
  `<DeletePostButton action={deletePostAction} />`로 교체. 페이지 시그니처에 `searchParams` 추가,
  `error` 존재 시 본문 상단에 빨간 톤 에러 배너 렌더.

## 핵심 결정

- spec을 그대로 따랐다. 다른 점 없음.
- 성공 판정은 `.select()` 반환 데이터가 아니라 `count`로 한다 — 소프트 삭제된 행은
  `posts_select(deleted_at is null)`를 통과하지 못해 `.select()`가 0행을 돌려주기 때문.
  postgrest-js의 `update(values, { count: "exact" })` 시그니처와 응답의 `count` 필드는
  설치된 버전(`node_modules/@supabase/postgrest-js/src/PostgrestQueryBuilder.ts:1571-1581`)에서 유효함을 확인.
- 권한 분기는 코드에 두지 않고 RLS(`posts_update`)에 위임, 결과(count)만 판정 (CLAUDE.md 원칙 3).
- `supabase/migrations/` 및 RLS 정책은 변경하지 않음 (spec 범위 제외 준수).

## 검증 방법

- 코드 검토:
  - `deletePost`가 `update` 전 `auth.getUser()`로 세션 검증 후 비로그인 리다이렉트 — actions.ts.
  - `error || !count`가 아니면 목록 redirect를 하지 않음 — actions.ts.
  - `confirm` 취소 시 제출 차단 — delete-post-button.tsx의 `onSubmit`.
  - `?error=` 배너 — page.tsx 상단.
- 빌드/타입체크: 이 환경에서는 `npm run build`/`npx tsc --noEmit`가 권한 승인 프롬프트로
  실행이 막혀 있어 직접 돌리지 못했다. **reviewer/watcher가 `npm run build`로 통과 확인 필요.**
  타입상 문제 없음을 코드 검토로 확인했다(count 옵션/반환 시그니처 검증 완료).
- 런타임 검증(별도 환경): 본인 글 상세에서 삭제 → confirm 노출 → 취소 시 잔류 → 확인 시 목록
  제거 및 직접 URL `notFound()`. 실패 경로는 만료 세션 등으로 0행 갱신 시 에러 배너 노출.
- 검증 글 `edb45a73-4192-4059-8f2f-9c81a3449ca1` 삭제는 런타임 환경에서 위 플로우로 수행 필요
  (이 구현 환경에는 실 DB 접근/세션이 없어 코드 변경에 포함하지 않음).

## 리뷰 포인트

- `redirect()`는 내부적으로 예외를 던지므로 `try/catch`로 감싸지 않았다. 의도된 동작.
- `revalidatePath` 두 개(목록·상세) 호출 후 목록으로 redirect하는 순서가 적절한지.
- 에러 배너 스타일(`rounded-xl bg-red-50 text-red-600 text-sm px-3 py-2`)이 기존 디자인 토큰과
  어울리는지 — spec 예시를 그대로 따랐다.
