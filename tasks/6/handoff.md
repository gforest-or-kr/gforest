# handoff: #6

## 변경 파일

- `app/boards/[slug]/post-form.tsx` (신규): 글쓰기/수정 공용 폼 컴포넌트.
  `write/page.tsx`의 `<form>` 마크업을 그대로 이관하고 `defaultValue` 바인딩 추가.
  마크업·클래스는 기존과 픽셀 동일.
- `app/boards/[slug]/write/page.tsx` (수정): 폼 마크업을 `<PostForm>` 사용으로 교체.
  권한 체크·리다이렉트 로직은 그대로 유지.
- `app/boards/[slug]/[postId]/edit/page.tsx` (신규): 수정 라우트. 비로그인 →
  `/login?returnTo=...`, 비작성자·비admin → 상세로 리다이렉트. 현재 값으로 폼 프리필.
- `app/boards/[slug]/actions.ts` (수정): `updatePost(slug, postId, formData)` 서버 액션 추가.
- `app/boards/[slug]/[postId]/page.tsx` (수정): 상단 바에 **수정** 진입 `<Link>` 추가
  (삭제 버튼과 동일한 `isAuthor || isAdmin` 조건, `flex items-center gap-1`로 그룹화).

## 핵심 결정

- **권한은 RLS에 위임** (CLAUDE.md 원칙 3). `updatePost`는 새 권한 분기를 만들지 않고
  `posts` UPDATE 결과를 본다. 본인·admin이 아니면 RLS `posts_update`가 0행 갱신을 만들고,
  `.select("id")` 결과 배열이 비면 edit로 error 리다이렉트한다(예외 없이 정상 종료).
- **event_date 분기**는 `createPost`와 동일 규칙: 달력형 게시판일 때만 `update` 객체에
  `event_date`를 포함한다. 비달력형에서는 UPDATE 페이로드에서 아예 제외해 건드리지 않는다.
- `updated_at`은 기존 `trg_posts_touch` 트리거가 자동 갱신 → 액션에서 건드리지 않음.
- **PostForm 헤더 문구**: spec이 prop 목록에 별도 헤더 prop을 두지 않고 `submitLabel`이
  "버튼/헤더 문구"를 겸한다고 명시했으므로, 헤더 동사("글쓰기"/"수정")는 `submitLabel`
  ("등록"/"저장")에서 파생했다(`submitLabel === "저장" ? "수정" : "글쓰기"`). 버튼 텍스트는
  `submitLabel` 그대로. 호출부가 둘뿐이라 단순 파생으로 충분하다고 판단.

## 검증 방법

- `npm run lint` / `npm run build` — **이 실행 환경에서 npm/npx가 권한 게이트에 막혀
  실행하지 못했다**(여러 차례 시도, 모두 "requires approval"). watcher 환경에서 반드시
  돌려 확인 필요. 타입은 수동 검토 완료: `posts` 테이블에 `author_id`/`event_date`/`title`/
  `content` 존재 확인(`lib/supabase/types.ts:208-249`), update payload 타입은 posts Update
  부분타입에 할당 가능.
- 동작 확인:
  1. 본인 글 상세 → 상단에 "수정" 노출, 클릭 시 현재 제목/본문(달력형이면 일정 날짜)으로
     채워진 폼.
  2. 저장 → 상세로 복귀, 변경 반영(목록·상세 `revalidatePath`).
  3. 타인 글 상세 → 수정·삭제 모두 미노출.
  4. 비로그인으로 `/boards/<slug>/<postId>/edit` 직접 접근 → `returnTo` 포함 `/login`.
  5. 비작성자·비admin 로그인 사용자가 edit 직접 접근 → 상세로 리다이렉트.
  6. 빈 제목/본문 저장 → `?error=...`로 edit 복귀.
  7. (가능하면) admin이 아닌 사용자가 우회로 타인 글 UPDATE 시도 → RLS 0행 → error 리다이렉트.

## 리뷰 포인트

- PostForm 헤더 문구 파생 방식(`submitLabel === "저장"` 비교)이 마음에 들지 않으면
  명시적 헤더 prop 추가가 대안. 현재는 spec의 prop 시그니처를 그대로 지키는 쪽을 택함.
- `updatePost`의 0행 판정: `.select("id")`가 배열을 반환하므로 `length === 0`으로 권한 차단을
  감지한다. soft-deleted 글은 edit 페이지 진입 단계에서 `deleted_at is null` 필터로 이미
  걸러지지만, 액션 자체는 `deleted_at` 조건 없이 `eq("id", postId)`만 건다(RLS·UI 게이트로 충분).
- build/lint 미실행이 유일한 미검증 항목. watcher가 통과 확인을 꼭 해줄 것.
