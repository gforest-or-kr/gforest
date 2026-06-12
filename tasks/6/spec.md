# spec: 본인 게시글에 수정 버튼이 없음 — 삭제만 존재 (#6)

## 요약

게시글 상세에 **삭제** 진입점만 있고 **수정(U)** 진입점·화면·서버 액션이 통째로 빠져
있다(게시판 CRUD P0의 U 누락). 이 이슈에서 (1) 상세 페이지 상단에 **수정** 링크를 본인/
관리자에게만 노출하고, (2) 기존 글쓰기 폼을 재사용한 **수정 화면**(`[postId]/edit`)을 추가해
제목·본문(달력 게시판은 일정 날짜 포함)을 채운 상태로 진입시키며, (3) `updatePost` 서버
액션을 추가해 저장 후 상세로 복귀시킨다. 권한은 DB(RLS `posts_update`: `author_id =
auth.uid() or is_admin()`)가 강제하고, 액션은 `createPost`/`deletePost`와 동일하게 **로그인
확인 + update 결과 검증 + 실패 시 에러 배너**로 처리한다.

**첨부파일 편집은 이 이슈 범위가 아니다**(이슈 기대 동작은 "제목/본문" 한정). 수정 화면은
제목·본문·일정만 다루며, 기존 첨부는 건드리지 않고 보존한다.

설계 결정(모호점 보수적 해석):
- **수정 버튼 노출 조건 = `isAuthor || isAdmin`** (삭제 버튼과 동일). 이슈 문구의 "작성자
  본인만"은 일반 회원 시나리오·서버 검증 요건을 가리키는 것으로 보고, 기존 삭제 버튼이
  이미 admin에게도 보이며 RLS도 admin update를 허용하므로 두 버튼을 대칭으로 둔다.
  서버 측 차단은 RLS가 author/admin으로 강제한다.
- **레거시 XE 글(`legacy_document_srl` 존재, 본문이 sanitize된 HTML)** 편집은 범위 제외.
  일반 회원의 본인 작성 글(비레거시)이 대상이며, WYSIWYG 에디터는 후속 과제다(범위 제외 참조).

## 구현 계획

### 1. `app/boards/[slug]/actions.ts` — `updatePost` 서버 액션 추가 (필수)

`createPost`(43–99)·`deletePost`(121–155) 패턴을 그대로 따른다. 기존 함수는 수정하지 않고
새 export만 추가한다.

```ts
export async function updatePost(slug: string, postId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "") || null;
  if (!title || !content) {
    redirect(`/boards/${slug}/${postId}/edit?error=${encodeURIComponent("제목과 내용을 입력해 주세요")}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}/edit`)}`);

  // board_type 확인 — calendar 게시판만 event_date 반영 (createPost와 동일 규칙)
  const { data: board } = await supabase
    .from("boards").select("id, board_type").eq("slug", slug).single();
  if (!board) redirect("/");

  const { data: updated, error } = await supabase
    .from("posts")
    .update({
      title,
      content,
      event_date: board.board_type === "calendar" ? eventDate : null,
    })
    .eq("id", postId)
    .is("deleted_at", null)
    .select("id"); // 활성 글이라 posts_select에 남으므로 성공 시 행 반환(=createPost 패턴)

  // RLS가 0행을 걸러도 .update()는 에러를 주지 않으므로 반환 행 수를 직접 검증한다.
  if (error || !updated || updated.length === 0) {
    redirect(`/boards/${slug}/${postId}/edit?error=${encodeURIComponent("수정에 실패했습니다. 권한을 확인해 주세요")}`);
  }

  revalidatePath(`/boards/${slug}`);
  revalidatePath(`/boards/${slug}/${postId}`);
  redirect(`/boards/${slug}/${postId}`);
}
```

- `deletePost`와 달리 **재조회가 필요 없다**: 수정된 글은 `deleted_at is null`이라
  `posts_select`에 그대로 보여 `.select("id")`가 성공 시 1행을 돌려준다(soft-delete가
  행을 숨겨 재조회가 필요했던 삭제와 반대).
- `redirect()`는 내부적으로 throw하므로 `try/catch`로 감싸지 말 것(`NEXT_REDIRECT` 오인 금지).
- `legacy_*` 컬럼은 읽지도 쓰지도 않는다(CLAUDE.md 주의사항).

### 2. `components/post-form.tsx` — 글쓰기/수정 공용 폼 컴포넌트 (필수, 신규)

이슈 요구("기존 글쓰기 폼을 재사용")와 최상위 가치(유지보수)에 맞춰 `write/page.tsx`의
폼 마크업을 공용 컴포넌트로 추출한다. 별도 클라이언트 상태가 없으므로 `"use client"`는
불필요(서버 컴포넌트가 그대로 렌더, 내부의 `AttachmentField`만 기존대로 클라이언트).

- props:
  - `action: (formData: FormData) => Promise<void>` — 바인딩된 서버 액션
  - `boardType: string` — `"calendar"`일 때만 일정 날짜 필드 렌더
  - `headingText: string` — 헤더 가운데 문구(예: `"자유게시판 글쓰기"` / `"자유게시판 수정"`)
  - `cancelHref: string` — 취소 링크 목적지
  - `submitLabel: string` — 제출 버튼 문구(`"등록"` / `"저장"`)
  - `error?: string` — 있으면 빨간 에러 배너 렌더
  - `defaults?: { title?: string | null; content?: string | null; eventDate?: string | null }`
    — 각 입력의 `defaultValue`(수정 진입 시 채움)
  - `showAttachments: boolean` — true일 때만 `<AttachmentField />` 렌더
- 마크업은 현재 `write/page.tsx`의 `<form>`(37–81)을 **그대로** 옮긴다(클래스·sticky 헤더·
  탭 타겟 유지). 변경점만:
  - 헤더 문구를 `{headingText}`, 제출 버튼 문구를 `{submitLabel}`, 취소 링크 href를
    `{cancelHref}`로 치환.
  - `title` 입력에 `defaultValue={defaults?.title ?? ""}`, `content` textarea에
    `defaultValue={defaults?.content ?? ""}`, 달력 `event_date` 입력에
    `defaultValue={defaults?.eventDate ?? ""}` 추가.
  - 에러 배너는 기존(48–50)과 동일: `{error && (<p className="mt-4 rounded-xl bg-red-50 text-red-600 text-sm px-4 py-3">{error}</p>)}`.
  - `<AttachmentField />`는 `{showAttachments && <AttachmentField />}`로 감싼다.
- 새 외부 라이브러리 추가 금지(CLAUDE.md 5).

### 3. `app/boards/[slug]/write/page.tsx` — 공용 폼으로 위임 (필수, 리팩터)

동작·외형은 **완전히 동일하게 유지**하면서 폼 본문을 `PostForm`으로 교체한다.

- 기존 권한 분기(`canWrite` 등 27–31)·`createPost.bind` 그대로 유지.
- 반환부를 다음으로 교체:
  ```tsx
  <main className="max-w-3xl mx-auto px-4 pb-24">
    <PostForm
      action={action}
      boardType={board.board_type}
      headingText={`${board.name} 글쓰기`}
      cancelHref={`/boards/${slug}`}
      submitLabel="등록"
      error={error}
      showAttachments
    />
  </main>
  ```
- import에서 직접 쓰던 `AttachmentField`는 `PostForm` 내부로 이동했으므로 이 파일에선 제거.

### 4. `app/boards/[slug]/[postId]/edit/page.tsx` — 수정 화면 (필수, 신규)

`write/page.tsx`·상세 `page.tsx`의 조회/권한 패턴을 따른다. `export const dynamic = "force-dynamic"`.

- `params: Promise<{ slug; postId }>`, `searchParams: Promise<{ error?: string }>`.
- 프로필·게시판·글을 `Promise.all`로 병렬 조회(상세 page.tsx 27–37 참조). 글 조회는
  `eq("id", postId).eq("boards.slug", slug).is("deleted_at", null).single()`, select에 작성자
  식별용 `author:profiles(id)` 포함.
- 가드:
  - `if (!board || !post) notFound();`
  - `if (!profile) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}/edit`)}`);`
  - `const isAuthor = profile.id === (post.author as { id: string } | null)?.id;`
    `const isAdmin = profile.role === "admin";`
    `if (!(isAuthor || isAdmin)) redirect(`/boards/${slug}/${postId}`);`  // UI 차단(최종 차단은 RLS)
- `const action = updatePost.bind(null, slug, postId);`
- 렌더:
  ```tsx
  <main className="max-w-3xl mx-auto px-4 pb-24">
    <PostForm
      action={action}
      boardType={board.board_type}
      headingText={`${board.name} 수정`}
      cancelHref={`/boards/${slug}/${postId}`}
      submitLabel="저장"
      error={error}
      defaults={{ title: post.title, content: post.content, eventDate: post.event_date }}
      showAttachments={false}
    />
  </main>
  ```

### 5. `app/boards/[slug]/[postId]/page.tsx` — 수정 진입점 추가 (필수)

`deletePost` import 옆에 변경 없음(수정 링크는 서버 액션이 아니라 `<Link>`). 현재
라인 109 `{(isAuthor || isAdmin) && <DeletePostButton action={deletePostAction} />}`를
수정+삭제 묶음으로 교체:

```tsx
{(isAuthor || isAdmin) && (
  <div className="flex items-center gap-1">
    <Link
      href={`/boards/${slug}/${postId}/edit`}
      className="text-slate-400 hover:text-forest-700 px-2 py-1"
    >
      수정
    </Link>
    <DeletePostButton action={deletePostAction} />
  </div>
)}
```

- `Link`는 이미 import되어 있음(라인 1). 노출 조건은 기존과 동일(`isAuthor || isAdmin`).
- 탭 타겟·디자인 토큰 등 기존 관습 유지(모바일 퍼스트, 44px+ 권장).

## Acceptance Criteria

- [ ] 본인(또는 admin) 글 상세 상단에 **수정** 링크가 보이고, **타인 글**(비작성자·비admin)
      에는 수정 링크가 보이지 않는다.
- [ ] 수정 링크 클릭 시 `/boards/<slug>/<postId>/edit`로 이동하며, 제목·본문(달력 게시판은
      일정 날짜까지)이 **기존 값으로 채워진 상태**로 글쓰기와 동일한 폼이 표시된다.
- [ ] 폼 제출(저장) 성공 시 제목/본문이 갱신되고 **해당 글 상세(`/boards/<slug>/<postId>`)
      로 복귀**하며, 변경 내용이 상세·목록에 반영된다.
- [ ] 제목이나 본문을 비우고 저장하면 저장되지 않고 에러 배너가 표시된다.
- [ ] `updatePost`는 `update` 결과(`error` 및 반환 행 수)를 검사하며, 권한 부족/RLS 차단 등
      실패 시 **상세로 이동하지 않고** 수정 화면에 머무르며 빨간 에러 배너를 보인다.
- [ ] 비로그인 상태에서 `/edit` 접근 또는 `updatePost` 호출 시 로그인 페이지로 redirect된다.
- [ ] 비작성자·비admin이 `/edit` URL에 직접 접근하면 상세로 redirect되고, 설령 액션이
      호출돼도 RLS(`posts_update`)가 0행으로 차단해 저장되지 않는다(서버 측 검증).
- [ ] 글쓰기(`write`) 페이지의 동작·외형이 리팩터 전과 동일하다(글 작성·첨부 정상).
- [ ] 새 클라이언트/공용 컴포넌트 외 추가된 외부 라이브러리가 없고, `vercel.json`의
      `regions: ["icn1"]`·기존 RLS·마이그레이션·`legacy_*` 컬럼은 변경되지 않았다.

## 검증 (구현자/리뷰어 수동 절차)

- 일반 회원으로 본인 자유게시판 글을 열어 **수정** 링크 노출을 확인하고, 제목·본문을 바꿔
  저장 → 상세 복귀 및 반영 확인.
- 다른 사용자(또는 비로그인) 시점에서 동일 글에 수정 링크가 보이지 않음을 확인.
- 비작성자 계정으로 `/boards/<slug>/<postId>/edit` URL 직접 접근 시 상세로 튕기는지 확인.
- 제목/본문 공란 저장 시 에러 배너 노출 확인.

## 범위 제외

- **첨부파일 편집**(기존 첨부 표시·삭제·교체, 신규 첨부 추가). 수정은 제목·본문·일정만
  다루고 기존 첨부는 보존한다. 첨부 편집은 후속 이슈로 분리 권장.
- **레거시 XE 글(`legacy_document_srl`)의 편집 특수 처리.** 본문이 HTML인 레거시 글을
  평문 textarea로 편집하는 케이스는 다루지 않는다(WYSIWYG 에디터는 후속 과제).
- 제목/본문 외 메타(작성자·작성일·게시판 이동 등) 변경.
- 수정 이력(버전 관리)·자동 저장·토스트 등 신규 알림 컴포넌트 도입.
- RLS `posts_update` 정책 변경(현 정책이 author/admin update를 이미 허용 — 정적 분석상
  보정 불필요).
