verdict: pass

# review: #17 (에픽 — 게시판 CRUD 보정: 삭제 #5 + 수정 #6)

에픽 #17은 하위 작업 #5(게시글 삭제 미동작)와 #6(수정 진입점/화면/액션 부재)으로 구성된다.
두 하위 작업의 spec.md / handoff.md 와 `git diff origin/main...HEAD`를 대조해 종합 판정한다.

## Acceptance Criteria 판정

### #5 — 게시글 삭제
- [x] 삭제 클릭 시 `confirm` 대화상자, 취소 시 아무 일 없음 — `components/delete-post-button.tsx`
      신규 클라이언트 컴포넌트가 `onSubmit`에서 `confirm` 취소 시 `preventDefault()`로 폼
      제출(=서버 액션)을 차단한다.
- [x] confirm 승인 후 본인 글 삭제 성공 시 목록에서 사라짐 — soft-delete update + `revalidatePath`
      (`actions.ts` deletePost).
- [x] 삭제된 글 직접 URL 접근 시 404 — 상세 page.tsx 쿼리가 `.is("deleted_at", null)`로 조회하고
      `if (!post) notFound()` (page.tsx:54). RLS `posts_select`도 `deleted_at is null` 강제
      (migration 290줄)이라 이중으로 차단됨.
- [x] 실패 시 목록 이동 없이 상세에 머무르며 빨간 에러 배너 — 실패 판정 시 `?error=`로 상세 redirect,
      page.tsx에 write와 동일한 빨간 배너 렌더(page.tsx:122-124).
- [x] deletePost가 update 결과를 검사하며 무조건 redirect하는 코드 제거 — `error` 캡처 + 재조회
      `stillVisible` 검증. 무조건 redirect 제거 확인.
- [x] 비로그인 시 로그인 페이지 redirect — `auth.getUser()` 후 `/login?returnTo=...`.
- [x] 외부 라이브러리 추가 없음, `vercel.json` 미변경 — diff에 vercel.json·package.json 없음.
- [x] RLS 보정 마이그레이션 미추가(조건부 항목) — 추가 없음. `legacy_*` 미변경.

### #6 — 게시글 수정
- [x] 본인/admin에게 수정 링크 노출, 타인에겐 미노출 — page.tsx:109 `{(isAuthor || isAdmin) && ...}`
      묶음 안에 수정 `<Link>` + 삭제 버튼. 삭제 버튼과 동일 노출 조건.
- [x] 수정 링크 → `/edit`, 기존 값(달력은 일정 날짜까지) 채워진 동일 폼 — `edit/page.tsx`가
      `PostForm`에 `defaults={{ title, content, eventDate }}` 전달, `post-form.tsx`가 각 입력에
      `defaultValue` 적용.
- [x] 저장 성공 시 갱신 + 상세 복귀, 상세·목록 반영 — `updatePost`가 `revalidatePath` 2건 후
      `/boards/${slug}/${postId}` redirect.
- [x] 제목/본문 공란 저장 시 에러 배너 — `updatePost` 초입 `if (!title || !content)` → `/edit?error=`.
- [x] updatePost가 결과 검사, 실패 시 상세 이동 없이 수정 화면에 머무르며 배너 — `.select("id")`
      반환 행 수(`error || !updated || updated.length === 0`) 검증 → `/edit?error=`.
- [x] 비로그인 시 로그인 페이지 redirect — `edit/page.tsx`의 `if (!profile)` 및 `updatePost`의
      `if (!user)` 양쪽에서 `/login?returnTo=...`.
- [x] 비작성자·비admin 직접 `/edit` 접근 시 상세 redirect + RLS 0행 차단 — `edit/page.tsx`
      `if (!(isAuthor || isAdmin)) redirect(상세)`. 서버 최종 차단은 `posts_update`
      (`author_id = auth.uid() or is_admin()`, migration 293-294줄).
- [x] write 페이지 동작·외형 리팩터 전과 동일 — `write/page.tsx`가 동일 마크업을 `PostForm`으로
      위임. `post-form.tsx`의 `<form>`이 기존 클래스·sticky 헤더·탭타겟·`AttachmentField`를 그대로
      이전(`showAttachments` 분기로 보존).
- [x] 외부 라이브러리·`vercel.json`·RLS·마이그레이션·`legacy_*` 미변경 — diff로 확인.

## 지적사항
없음 (반려 사유 없음).

## 비고 (사람 승인자 참고)

1. **#5의 검증 방식이 spec과 다르며, 그 변경이 오히려 정확하다.** spec 1번은 soft-delete
   `update(...).select("id")`의 반환 행 수로 성공을 판정하라 했으나, 구현자는 재조회
   (`stillVisible`) 방식으로 바꿨다. 근거를 RLS로 실증 확인함: `posts_select` 정책이
   `deleted_at is null`을 요구하므로(migration:290), soft-delete된 행은 RETURNING에서 사라져
   `.select("id")`가 **성공이어도 빈 배열**을 돌려준다. spec의 문구를 그대로 따랐다면 모든 정상
   삭제가 실패로 오판됐을 것이다. 구현자의 일탈은 정당하며 실제 버그를 예방한다. (수정 #6은
   활성 글이라 행이 남으므로 `.select("id")` 행 수 검증이 그대로 유효 — 두 케이스를 올바르게
   구분했다.)

2. **빌드/타입체크 미실행.** 두 handoff 모두 이 환경의 승인 게이트로 `npx tsc --noEmit` /
   `npm run build` / `npm run lint`를 돌리지 못했다고 명시. 코드가 기존 패턴(createPost, 상세
   page.tsx)을 충실히 따르고 `post.author as { id: string } | null` 캐스팅도 상세 페이지의 동일
   패턴과 일치하지만, **머지 전 CI/로컬에서 타입체크·빌드 1회 확인을 권한다.**

3. **`stillVisible` 재조회의 알려진 경계(구현자 자진 보고).** 존재하지 않는 임의 postId로
   deletePost를 직접 호출하면 `stillVisible`이 null이라 "성공"으로 판정돼 목록으로 redirect된다.
   삭제 버튼은 로드된 본인/admin 글에만 렌더되고 RLS가 타인 글 실삭제를 차단하므로 실질 위험은
   없다. 별도 가드 미추가는 합리적 판단으로 본다.

4. **검증용 테스트 글 최종 삭제 미확인.** spec #5의 수동 절차는 이슈에 남은 테스트 글
   `/boards/free/edb45a73-...`을 최종 삭제해 목록·직접 URL에서 사라짐을 확인하라고 요구하나,
   DB 실행이 막혀 실증되지 않았다. 승인 후 실환경에서 성공 경로(본인 글 1회 삭제 → 목록 사라짐
   → 직접 URL 404)를 한 번 확인하면 좋다.
