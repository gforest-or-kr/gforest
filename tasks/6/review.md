verdict: pass

# review: #6

## Acceptance Criteria 판정

- [x] 공용 폼 컴포넌트 추출 — `app/boards/[slug]/post-form.tsx` 신규 생성. `write/page.tsx`가
      `<PostForm>`을 사용하도록 교체됨. 마크업·클래스가 기존과 픽셀 동일하다(취소 Link, sticky
      바, error 배너, title/event_date/content 입력 모두 동일 클래스). 글쓰기 경로에서
      `submitLabel="등록"` → 헤더 "글쓰기" / 버튼 "등록"으로 기존 외형 그대로 재현된다.
- [x] edit 라우트 존재 (`app/boards/[slug]/[postId]/edit/page.tsx`). `boards`·`posts`·`profile`을
      `Promise.all`로 병렬 조회하고, 글 조회는 상세와 동일하게 `boards!inner(slug)`+`eq("boards.slug")`
      +`is("deleted_at", null)` 조건. `defaultValues`로 title/content/event_date를 프리필한다.
- [x] 비로그인 → `/login?returnTo=...`(encodeURIComponent 처리), 비작성자·비admin →
      `/boards/${slug}/${postId}` 리다이렉트. 게시판/글 없으면 `notFound()`. 순서도 올바르다
      (notFound → 로그인 게이트 → 권한 게이트).
- [x] `updatePost(slug, postId, formData)` 추가. title/content 갱신 후 성공 시 상세로 redirect,
      `revalidatePath`로 목록(`/boards/${slug}`)·상세(`/boards/${slug}/${postId}`) 둘 다 무효화.
- [x] 새 권한 분기 없이 RLS(`posts_update`)에 위임. `.update().eq("id", postId).select("id")`로
      영향 행을 받아 `length === 0`이면 error 리다이렉트 — 예외 없이 정상 종료한다. `createPost`의
      위임 패턴과 일관됨.
- [x] 빈 title/content 시 `/boards/${slug}/${postId}/edit?error=...`로 되돌림(검증이 supabase
      클라이언트 생성·인증보다 먼저 수행).
- [x] 달력형 분기: `board_type === "calendar"`일 때만 `update.event_date` 포함, 비달력형은 payload에서
      제외하여 건드리지 않음. PostForm도 calendar일 때만 `event_date` 입력 노출. spec 규칙과 일치.
- [x] 상세 상단 수정 진입점이 기존 삭제 버튼과 동일한 `(isAuthor || isAdmin)` 블록 안에 추가됨.
      `flex items-center gap-1`로 그룹화, 삭제 앞에 배치. 타인 글에는 수정·삭제 모두 미노출.
- [~] `npm run build` / `npm run lint` — 리뷰어 권한상 실행하지 않음(아래 비고). 타입은 수동 검토상
      문제 없음.

## 지적사항

없음. (criteria 미충족·실질 결함 없음)

## 비고

- **빌드/린트 미실행**: 리뷰어는 git diff/log 외 Bash가 허용되지 않아 `npm run build`·`npm run lint`를
  직접 돌리지 않았다. handoff에도 implementer 환경에서 권한 게이트로 미실행이라 명시됨. **watcher가
  병합 전 반드시 통과 확인할 것.** 다만 정적 검토상 타입 위험 요소는 없다:
  - `PostForm.action` 타입 `(formData: FormData) => void | Promise<void>`에 `updatePost.bind(null, slug, postId)`/`createPost.bind(null, slug)` 모두 할당 가능.
  - `update` 객체 부분타입(`{title, content, event_date?}`)은 `posts` Update 타입에 할당 가능, `event_date`는 `string | null`.
  - `defaultValues?.event_date ?? undefined`로 `date` input의 `defaultValue` 타입(`string | undefined`) 충족.
- **헤더 문구 파생 방식**: PostForm이 별도 헤더 prop 없이 `submitLabel === "저장" ? "수정" : "글쓰기"`로
  헤더 동사를 파생한다. spec이 `submitLabel`을 "버튼/헤더 문구 겸용"으로 규정했고 호출부가 둘뿐이라
  현 구현은 spec 시그니처를 그대로 지킨 선택이다. 동작상 정확하며 반려 사유 아님. 향후 제3의 호출부가
  생기면(예: submitLabel이 "저장"/"등록" 외 값) 헤더가 "글쓰기"로 잘못 파생될 수 있으니, 그때 명시적
  헤더 prop으로 전환을 권한다(현 범위에선 불필요).
- **updatePost의 deleted_at 미필터**: 액션은 `eq("id", postId)`만 걸고 `deleted_at` 조건이 없다.
  edit 페이지 진입 단계에서 이미 `deleted_at is null`로 걸러지고 RLS·UI 게이트가 있어 실무상 문제
  없으나, 삭제된 글에 대한 직접 POST 시 RLS가 막지 않으면 갱신될 여지는 이론상 존재한다. 이번 이슈
  범위 밖이며 spec이 요구하지 않으므로 pass 유지.
