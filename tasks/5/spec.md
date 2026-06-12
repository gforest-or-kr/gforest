# spec: 게시글 삭제가 동작하지 않음 — 버튼 클릭해도 글이 남고 에러 표시 없음 (#5)

## 요약

게시글 상세의 **삭제** 버튼이 (1) 확인 단계 없이 (2) 결과를 검증하지 않고 목록으로
라우팅한다. 핵심 결함은 서버 액션 `deletePost`가 soft-delete `update`의 결과를 전혀
확인하지 않는다는 점이다. Supabase의 `.update()`는 **조건에 맞는 행이 0개여도 에러를
반환하지 않으므로**, RLS 차단·잘못된 id·세션 누락 등 어떤 실패도 조용히 묻히고 항상
`redirect`가 실행된다. 그 결과 글은 남고(`deleted_at` 미설정 → 직접 URL 접근·조회수 증가),
사용자에겐 아무 피드백도 없다.

이 이슈에서는 (a) 삭제 전 `confirm` 단계 추가, (b) 액션이 삭제 결과(영향 행 수/에러)를
검증하도록 수정, (c) 실패 시 사용자에게 에러 노출, (d) DB 차원의 실제 차단 여부를
실증 확인하고 필요한 경우에만 RLS 보정을 적용한다.

참고: `deletePost`의 RLS 정책(`posts_update`: `author_id = auth.uid() or is_admin()`)은
정적 분석상 작성자 본인의 soft-delete를 허용하는 것으로 보인다. 따라서 RLS 마이그레이션은
**무조건 추가하지 말고**, 결과 검증으로 실제 실패 원인을 확인한 뒤 조건부로만 적용한다.

## 구현 계획

### 1. `app/boards/[slug]/actions.ts` — `deletePost` 결과 검증 (필수)

현재(라인 121–130)는 결과를 버리고 무조건 목록으로 redirect한다. 다음으로 교체한다.

- soft-delete `update`에 `.select("id")`를 체이닝해 **실제로 변경된 행을 반환**받는다.
- 추가로 본인/admin이 아닌 호출을 조기에 거르기 위해 `auth.getUser()`로 로그인 여부를
  확인한다(`createPost`와 동일 패턴). 비로그인 시 `/login?returnTo=...`로 redirect.
- 판정:
  - `error`가 있거나 `data`가 비어 있으면(`!data || data.length === 0`) → **목록으로 가지
    말고** 상세 페이지로 에러와 함께 redirect:
    `redirect(\`/boards/${slug}/${postId}?error=${encodeURIComponent("삭제에 실패했습니다. 권한을 확인해 주세요")}\`)`
  - 성공 시에만 `revalidatePath(\`/boards/${slug}\`)` + `revalidatePath(\`/boards/${slug}/${postId}\`)`
    후 `redirect(\`/boards/${slug}\`)`.
- `redirect()`는 내부적으로 throw하므로 `try/catch`로 감싸지 말 것(`NEXT_REDIRECT` 오인 처리 금지).

### 2. `components/delete-post-button.tsx` — 확인 단계 (필수, 신규 클라이언트 컴포넌트)

상세 페이지는 서버 컴포넌트라 `confirm()`(브라우저 JS)을 직접 쓸 수 없다. 삭제 폼만
클라이언트 컴포넌트로 분리한다(`components/attachment-field.tsx`의 `"use client"` 패턴 참조).

- props: 바인딩된 서버 액션 하나(`action: () => Promise<void>`).
- `<form action={action} onSubmit={(e) => { if (!confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) e.preventDefault(); }}>`
  안에 기존 `삭제` 버튼(현재 page.tsx:103의 클래스/문구 유지)을 둔다.
- 디자인 토큰·탭 타겟(44px+) 등 기존 스타일 관습 유지. 새 라이브러리 추가 금지(CLAUDE.md 5).

### 3. `app/boards/[slug]/[postId]/page.tsx` — 컴포넌트 연결 + 에러 배너 (필수)

- `searchParams: Promise<{ error?: string }>`를 받아 `error`를 읽는다(write 페이지와 동일 시그니처).
- 본문 상단(예: 제목 영역 근처)에 write 페이지(`write/page.tsx:48-50`)와 동일한 에러 배너를
  렌더:
  `{error && (<p className="mt-4 rounded-xl bg-red-50 text-red-600 text-sm px-4 py-3">{error}</p>)}`
- 기존 인라인 `<form action={deletePostAction}>`(라인 102–105)을
  `<DeletePostButton action={deletePostAction} />`로 교체. `(isAuthor || isAdmin)` 노출 조건은 유지.

### 4. DB 실증 확인 후 조건부 RLS 보정 (조건부)

결과 검증(1번)을 적용한 뒤 **본인 글로 실제 삭제를 1회 수행**해 원인을 확정한다.

- 정상적으로 1행이 변경되면(`data.length === 1`, `deleted_at` 설정됨) RLS는 문제 없음 →
  마이그레이션 불필요. 이 이슈는 1~3번으로 종결.
- 작성자 본인인데도 0행이 변경되면 → `supabase/migrations/`에 **새 번호의 마이그레이션
  파일**로 `posts_update` 정책을 보정한다(대시보드 수동 변경 금지, CLAUDE.md 2). 기존
  정책 파일(`00000000000001_initial_schema.sql`)은 **수정하지 말 것**. 보정 후
  `supabase gen types typescript`로 타입 재생성이 필요한지 확인(정책 변경만이면 불필요).
- 어느 경로든, **무엇을 확인했고 마이그레이션을 추가했는지/안 했는지**를 PR/커밋 메시지에 명시.

### 5. (선택) `deleteComment` 동일 패턴

`deleteComment`(actions.ts:132–139)도 결과를 버리는 동일한 silent-fail 구조다. 다만 본
이슈 범위는 **게시글 삭제**이므로 이번에는 손대지 않는다(범위 제외 참조).

## Acceptance Criteria

- [ ] 삭제 버튼 클릭 시 브라우저 `confirm` 대화상자가 뜨고, **취소하면 아무 일도 일어나지
      않는다**(라우팅·삭제 모두 없음).
- [ ] `confirm` 승인 후 본인 글 삭제가 성공하면, 해당 글이 게시판 목록에서 사라진다.
- [ ] 삭제 성공한 글의 직접 URL 접근 시 404(`notFound`)가 반환된다(조회수 증가 없음).
- [ ] 삭제가 실패하는 경우(권한 없음/RLS 차단 등) **목록으로 이동하지 않고** 상세 페이지에
      머무르며 빨간 에러 배너가 표시된다.
- [ ] `deletePost`는 `update` 결과(`error` 및 반환 행 수)를 검사하며, 결과를 무시한 채
      무조건 `redirect`하는 코드가 더 이상 없다.
- [ ] 비로그인 상태에서 삭제 액션이 호출되면 로그인 페이지로 redirect된다.
- [ ] 새 클라이언트 컴포넌트 외에 추가된 외부 라이브러리가 없다. `vercel.json`의
      `regions: ["icn1"]` 등 기존 설정은 변경되지 않았다.
- [ ] (RLS 보정을 한 경우) 변경은 기존 마이그레이션 수정이 아니라 **새 마이그레이션 파일**로
      이뤄졌고, `posts` 테이블의 `legacy_*` 컬럼은 건드리지 않았다.

## 검증 (구현자/리뷰어 수동 절차)

- 이슈에 남은 테스트 글 `/boards/free/edb45a73-4192-4059-8f2f-9c81a3449ca1`(`[동작검증]
  자동 테스트 글입니다`)을 삭제 검증 대상으로 사용하고, **검증 완료 후 최종적으로 삭제**해
  목록·직접 URL에서 사라지는지 확인한다(이슈 본문 요구).
- 본인 글 삭제(성공 경로) / 타인 글 삭제 시도(실패 경로, 가능 시) 양쪽을 모두 확인한다.

## 범위 제외

- 댓글 삭제(`deleteComment`)의 동일한 silent-fail 패턴 수정 — 본 이슈는 게시글 삭제 한정.
  (동일 구조이므로 후속 이슈로 분리 권장)
- 삭제된 글의 복구(undelete)·휴지통 UI.
- 토스트/스낵바 등 새 알림 컴포넌트 도입 — 기존 인라인 에러 배너 패턴으로 충분.
- 첨부파일/Storage 객체의 물리 삭제(soft delete만 수행, 기존 동작 유지).
- 정적 분석상 정상으로 보이는 RLS 정책의 선제적 변경(실증 0행 확인 시에만 보정).
