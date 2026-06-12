# handoff: #6

## 변경 파일
- `components/post-form.tsx` (신규): 글쓰기/수정 공용 폼 컴포넌트. `write/page.tsx`의
  `<form>` 마크업을 그대로 추출(클래스·sticky 헤더·탭타겟 유지). props로 `action`,
  `boardType`, `headingText`, `cancelHref`, `submitLabel`, `error`, `defaults`,
  `showAttachments`를 받음. 클라이언트 상태가 없어 서버 컴포넌트(내부 `AttachmentField`만
  클라이언트). 각 입력에 `defaultValue`(수정 진입 시 기존 값) 추가.
- `app/boards/[slug]/write/page.tsx` (리팩터): 폼 본문을 `PostForm`으로 위임. 권한 분기·
  `createPost.bind`·`force-dynamic`은 그대로. 미사용이 된 `Link`/`AttachmentField` import 제거.
- `app/boards/[slug]/actions.ts` (추가): `updatePost(slug, postId, formData)` 신규 export.
  `createPost`/`deletePost` 패턴 그대로 — 로그인 확인 + board_type 조회 + update +
  반환 행 수 검증 + 실패 시 `/edit?error=` 배너, 성공 시 `revalidatePath` 후 상세로 redirect.
  기존 함수는 미변경.
- `app/boards/[slug]/[postId]/edit/page.tsx` (신규): 수정 화면. 프로필·게시판·글 병렬 조회,
  `notFound`/로그인 redirect/`isAuthor||isAdmin` UI 가드 후 `PostForm`에 기존 값 채워 렌더.
- `app/boards/[slug]/[postId]/page.tsx` (수정): 상단 액션 영역의 단독 `DeletePostButton`을
  `(isAuthor || isAdmin)` 조건의 **수정 `<Link>` + 삭제 버튼** 묶음으로 교체.

## 핵심 결정
- spec을 그대로 따랐다. 별도 일탈 없음.
- **수정 버튼 노출 = `isAuthor || isAdmin`** (삭제 버튼과 대칭). 서버 측 최종 차단은
  RLS `posts_update`(author/admin)가 강제. 액션은 RLS가 0행을 걸러도 에러를 주지 않으므로
  `.select("id")` 반환 행 수로 직접 검증한다(활성 글이라 `posts_select`에 남아 성공 시 1행 반환
  — soft-delete로 행이 사라져 재조회가 필요했던 `deletePost`와 반대 케이스).
- `redirect()`는 내부적으로 throw하므로 `try/catch`로 감싸지 않음(`NEXT_REDIRECT` 오인 방지).
- 첨부/레거시 HTML 편집은 범위 외 — 수정 화면은 `showAttachments={false}`이며 기존 첨부는
  건드리지 않고 보존(`posts` row만 update). `legacy_*` 컬럼은 읽지도 쓰지도 않음.

## 검증 방법
- 타입 검사: `npx tsc --noEmit` / 린트: `npm run lint` (이 환경에선 승인 제약으로 미실행 —
  watcher 측 검증 필요).
- 수동:
  1. 일반 회원으로 본인 자유게시판 글 상세 → 상단에 **수정** 링크 노출 확인.
  2. 수정 링크 클릭 → `/boards/<slug>/<postId>/edit`, 제목·본문(달력 게시판은 일정 날짜까지)이
     기존 값으로 채워진 폼 표시 확인.
  3. 제목/본문 수정 후 저장 → 상세로 복귀 + 목록·상세에 반영 확인.
  4. 제목 또는 본문 공란 저장 → 저장 안 되고 빨간 에러 배너 표시.
  5. 비작성자/비로그인 시점에서 동일 글에 수정 링크 미노출, `/edit` 직접 접근 시 상세로 redirect
     (비로그인은 로그인 페이지로). 액션이 호출돼도 RLS가 0행으로 차단.
  6. 글쓰기 페이지 동작·외형이 리팩터 전과 동일(작성·첨부 정상).

## 리뷰 포인트
- `edit/page.tsx`의 글 조회 select(`author:profiles(id), boards!inner(slug)`)와
  `post.author as { id: string } | null` 캐스팅이 Supabase 타입과 맞는지(상세 page.tsx의
  동일 패턴을 따랐으나 nickname 미선택). `tsc` 미실행 상태라 타입 확인 부탁.
- `PostForm` 추출이 기존 글쓰기 화면의 외형·동작을 100% 보존하는지(특히 sticky 헤더 클래스,
  `AttachmentField` 위치).
