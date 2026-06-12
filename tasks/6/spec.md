# spec: 본인 게시글에 수정 버튼이 없음 — 삭제만 존재 (#6)

## 요약

게시판 CRUD 중 U(수정)가 빠져 있다. 글 상세 페이지(`app/boards/[slug]/[postId]/page.tsx`)
상단에 **삭제** 버튼만 있고 **수정** 진입점이 없으며, 수정용 라우트·서버 액션도 존재하지
않는다. 기존 글쓰기 폼(`write/page.tsx`)과 `createPost` 액션 구조를 재사용해, 작성자
본인(및 admin)이 자기 글의 제목/본문(달력형 게시판은 일정 날짜 포함)을 수정할 수 있는
경로를 추가한다.

권한의 실제 강제는 이미 DB가 한다: RLS `posts_update` 정책이
`author_id = auth.uid() or is_admin()`으로 본인·admin만 UPDATE를 허용한다
(`supabase/migrations/00000000000001_initial_schema.sql:293-294`). 따라서 서버 측 검증은
별도 권한 분기를 새로 구현하지 않고 RLS에 위임하며(CLAUDE.md 원칙 3), 앱 코드의 권한 검사는
UI 노출 제어 및 비인가 접근 시 리다이렉트 용도로만 사용한다.

## 구현 계획

기존 글쓰기 폼 마크업을 수정 화면과 공유하기 위해 **공용 폼 컴포넌트를 추출**한 뒤,
수정 라우트·수정 액션·상세 페이지의 수정 버튼을 추가한다. 폼 마크업을 복제하지 않는 것이
유지보수 관점(CLAUDE.md 원칙 5)에서 핵심이다.

### 1. 공용 폼 컴포넌트 추출 — `app/boards/[slug]/post-form.tsx` (신규)

`write/page.tsx`의 `<form>` 내부 마크업(제목 input, 달력형 `event_date` input, 본문
textarea, 상단 sticky 바의 취소/등록 버튼, error 배너)을 그대로 옮긴 서버 컴포넌트.
다음 props를 받는다:

- `action`: 폼 제출 서버 액션 (이미 bind된 상태로 전달)
- `boardName: string`, `boardType: string` (달력형 분기용)
- `slug: string` (취소 링크 `/boards/${slug}` 또는 상세로 복귀용)
- `cancelHref: string` — 취소 링크 목적지 (글쓰기: `/boards/${slug}`, 수정: 상세 경로)
- `submitLabel: string` — 버튼/헤더 문구 (글쓰기: "등록"/"{board} 글쓰기",
  수정: "저장"/"{board} 수정")
- `error?: string`
- `defaultValues?: { title?: string; content?: string; event_date?: string | null }`
  — input/textarea의 `defaultValue`로 사용 (수정 시 채워 넣음). 미전달 시 빈 폼.

마크업·클래스는 현재 `write/page.tsx`와 픽셀 동일하게 유지한다(스타일 변경 없음). 단,
`title`/`content`/`event_date` 입력에 `defaultValue`를 바인딩한다.

### 2. `app/boards/[slug]/write/page.tsx` (수정)

폼 마크업을 직접 들고 있던 부분을 `<PostForm>` 사용으로 교체한다. 동작·권한 체크·리다이렉트
로직은 그대로 두고, 렌더 결과만 새 공용 컴포넌트로 위임한다(`submitLabel="등록"`,
`cancelHref={`/boards/${slug}`}`, `defaultValues` 없음, `error` 전달).

### 3. 수정 라우트 — `app/boards/[slug]/[postId]/edit/page.tsx` (신규)

`write/page.tsx`를 본떠 작성:

- `params`: `{ slug, postId }`, `searchParams`: `{ error?: string }`
- `getSessionProfile()`·`boards`·해당 `posts` 행(작성자 id 포함)을 병렬 조회.
  글 조회는 상세 페이지와 동일하게 `deleted_at is null`, slug 일치 조건.
- 게시판/글이 없으면 `notFound()`.
- 비로그인 → `/login?returnTo=/boards/${slug}/${postId}/edit` 로 리다이렉트.
- 권한 게이트(UI/접근 제어용): 작성자 본인도 admin도 아니면 상세
  (`/boards/${slug}/${postId}`)로 리다이렉트. (실제 차단은 RLS가 하지만, 수정 폼 자체를
  비인가 사용자에게 보여주지 않기 위함.)
- `updatePost.bind(null, slug, postId)` 를 action으로 `<PostForm>` 렌더:
  `submitLabel="저장"`, `cancelHref={`/boards/${slug}/${postId}`}`,
  `defaultValues={{ title: post.title, content: post.content, event_date: post.event_date }}`.

### 4. 수정 서버 액션 — `app/boards/[slug]/actions.ts` 에 `updatePost` 추가

`createPost`와 동일한 패턴:

```
export async function updatePost(slug: string, postId: string, formData: FormData)
```

- `title`/`content` trim·필수 검증, 빈 값이면
  `/boards/${slug}/${postId}/edit?error=...` 로 리다이렉트.
- `auth.getUser()` 로 비로그인 시 로그인 리다이렉트.
- 달력형 게시판 여부 판단을 위해 게시판 `board_type`을 조회(또는 글의 board 조인)해
  `event_date`를 calendar일 때만 반영(`createPost`와 동일 규칙).
- `posts` UPDATE: `.update({ title, content, event_date: ... }).eq("id", postId)`.
  **권한은 RLS가 강제** — 본인·admin이 아니면 0행 갱신. 갱신 결과(에러 또는 영향 0행)면
  edit로 error 리다이렉트(문구 예: "수정에 실패했습니다. 권한을 확인해 주세요").
  영향 행 수 확인을 위해 `.select("id")` 등으로 갱신 결과를 받는다.
- 성공 시 `revalidatePath(`/boards/${slug}`)` 및
  `revalidatePath(`/boards/${slug}/${postId}`)` 후 상세로 `redirect`.

`updated_at`은 기존 `trg_posts_touch` 트리거가 자동 갱신하므로 액션에서 건드리지 않는다.

### 5. 상세 페이지 수정 버튼 — `app/boards/[slug]/[postId]/page.tsx` (수정)

상단 바의 삭제 `<form>` 영역(101–105행)에서, 동일한 `(isAuthor || isAdmin)` 조건 안에
삭제 버튼 **앞에** 수정 진입 `<Link>` 를 추가한다. 두 컨트롤을 한 그룹으로 묶어 우측 정렬
유지(예: `flex items-center gap-1` 컨테이너).

```
<Link href={`/boards/${slug}/${postId}/edit`} className="...px-2 py-1">수정</Link>
```

스타일은 기존 삭제 버튼과 톤을 맞추되(slate 계열, 탭 타겟 44px 고려), forest 팔레트 내에서
처리한다. 노출 조건은 삭제 버튼과 동일하게 `isAuthor || isAdmin`을 사용한다 — RLS가 본인·admin
모두에게 UPDATE를 허용하고 삭제 버튼도 같은 조건을 쓰므로 UI 일관성을 위해 동일하게 둔다
(이슈의 "작성자 본인만"은 일반 회원 시나리오 기준이며, admin 모더레이션은 삭제와 동일 취급).

## Acceptance Criteria

- [ ] `app/boards/[slug]/post-form.tsx` 공용 폼 컴포넌트가 추가되고, `write/page.tsx`가
      이를 사용하도록 변경되어 글쓰기 폼의 외형·동작이 기존과 동일하다.
- [ ] `app/boards/[slug]/[postId]/edit/page.tsx` 라우트가 존재하며, 작성자 본인(또는 admin)이
      접근하면 제목·본문(달력형이면 일정 날짜 포함)이 **현재 값으로 채워진** 폼이 렌더된다.
- [ ] 위 edit 라우트에 비로그인으로 접근하면 `returnTo`를 포함해 `/login`으로,
      작성자도 admin도 아닌 로그인 사용자가 접근하면 해당 글 상세로 리다이렉트된다.
- [ ] `app/boards/[slug]/actions.ts`에 `updatePost(slug, postId, formData)` 서버 액션이
      추가되어, 제목/본문을 갱신하고 성공 시 해당 글 상세(`/boards/${slug}/${postId}`)로
      복귀하며 목록·상세 경로를 `revalidatePath` 한다.
- [ ] `updatePost`는 새 권한 분기를 구현하지 않고 RLS(`posts_update`)에 위임한다.
      본인·admin이 아닌 경우 0행 갱신 → error 리다이렉트로 처리되며, 정상 종료(예외 없음)한다.
- [ ] `updatePost`는 빈 제목/본문 입력 시 edit 페이지로 `?error=...`와 함께 되돌려보낸다.
- [ ] 달력형(`board_type === "calendar"`) 게시판 수정 시 `event_date`가 폼에 노출·갱신되고,
      비달력형 게시판에서는 `event_date`를 건드리지 않는다(`createPost`와 동일 규칙).
- [ ] 상세 페이지 상단에 **수정** 진입점이 `isAuthor || isAdmin` 조건에서만 노출된다.
      타인 글(비작성자·비admin)에는 수정·삭제 모두 노출되지 않는다.
- [ ] `npm run build`(또는 `next build`)와 `npm run lint`가 통과한다. 타입 에러 없음.

## 범위 제외

- WYSIWYG 에디터·첨부파일 추가/삭제·이미지 처리는 이번 이슈 대상이 아니다
  (글쓰기 폼의 현재 한계를 그대로 따른다 — `write/page.tsx` 주석 SCR-320 참조).
- XE 이관 글(`legacy_document_srl` 존재, `content`가 sanitize된 HTML)의 편집 UX는 다루지
  않는다. 일반 회원이 작성·소유한 평문 글이 대상이며, 레거시 HTML이 평문 textarea에 그대로
  노출되는 동작은 알려진 제약으로 둔다.
- 댓글 수정, 공지(`is_notice`) 토글, 예약/일정 시간(`event_start`/`event_end`) 편집은 범위 밖.
- DB 스키마/RLS/마이그레이션 변경 없음 — 기존 `posts_update` 정책으로 충분하다.
