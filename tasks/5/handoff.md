# handoff: #5

## 변경 파일

- `app/boards/[slug]/actions.ts` — `deletePost`가 삭제 결과를 검증하도록 수정. 비로그인
  조기 차단(`auth.getUser()` → `/login?returnTo=...`), soft-delete `update` 실행 후
  **재조회로 실제 삭제 여부를 확인**, 실패 시 상세 페이지로 에러와 함께 redirect.
- `components/delete-post-button.tsx` — 신규 클라이언트 컴포넌트. `onSubmit`에서
  `confirm()`으로 삭제 확인, 취소 시 `preventDefault()`로 제출(=서버 액션) 차단.
- `app/boards/[slug]/[postId]/page.tsx` — `searchParams: { error? }` 수신, 본문 상단에
  write 페이지와 동일한 빨간 에러 배너 렌더, 인라인 삭제 `<form>`을
  `<DeletePostButton>`으로 교체(노출 조건 `isAuthor || isAdmin` 유지).

마이그레이션 추가 없음. `vercel.json`·`legacy_*` 컬럼 등 기존 설정/스키마 미변경.

## 핵심 결정

**spec 1번의 검증 방식을 `.select("id")` 행 수 확인 → 재조회 확인으로 변경했다.** 이유:

- `posts_select` RLS 정책은 `deleted_at is null`을 요구한다. soft-delete로 `deleted_at`이
  채워진 행은 이 SELECT 정책을 통과하지 못하므로, `update(...).select("id")`의 RETURNING
  결과가 **성공이어도 빈 배열**로 돌아온다. 같은 레포의 `createPost`가
  `insert(...).select("id")`로 동작하는 것은 신규 행이 `deleted_at null`이라 SELECT 정책을
  통과하기 때문 — 즉 soft-delete는 정확히 그 반대 상황이다.
- 따라서 spec이 제안한 `!data || data.length === 0` 판정을 그대로 쓰면 **모든 정상 삭제가
  실패로 오판**되어 항상 에러 배너가 뜬다(성공 경로가 깨짐).
- 대신 update(에러 캡처) 후 `posts`를 `id` + `deleted_at is null`로 재조회하여,
  "여전히 보이는 글이 남아 있으면(`stillVisible`) 또는 `error`가 있으면" 실패로 판정한다.
  이 방식은 RETURNING/SELECT-정책 상호작용과 무관하게 **삭제 효과 자체**(글이 사라졌는가)를
  직접 확인하므로 모든 경우에 정확하다. 비용은 PK 단건 재조회 1회로 무시 가능.

**spec 4번(RLS 보정)은 적용하지 않았다.** 정적 분석상 `posts_update`
(`author_id = auth.uid() or is_admin()`)는 작성자 본인의 soft-delete를 허용하며, 위 재조회
검증이 RLS 차단을 정확히 잡아내므로 마이그레이션이 불필요하다. 또한 이 환경에서는
프로세스/네트워크 실행(`supabase status`, `tsc`)이 승인 게이트에 막혀 **실 DB 실증 1회를
직접 수행하지 못했다** — 그래서 RLS 동작에 의존하지 않는 위 방어적 설계를 택했다.

`update`에 `.is("deleted_at", null)` 필터를 추가해 이미 삭제된 글의 timestamp 재갱신을 막고
멱등성을 확보했다(spec 명시 외 사항이나 무해).

## 검증 방법

빌드/타입체크는 이 환경에서 실행 승인이 막혀 수행하지 못함 — 리뷰어 측 확인 요망:

```
npx tsc --noEmit
npm run build
```

기능 확인(spec 검증 절차):

1. **취소 경로**: 본인 글 상세에서 삭제 클릭 → confirm 대화상자 "취소" → 아무 변화 없음
   (라우팅·삭제 모두 없음).
2. **성공 경로**: confirm "확인" → 게시판 목록에서 글이 사라짐 → 해당 글 직접 URL 접근 시
   404(`notFound`, 조회수 미증가).
3. **실패 경로**: 타인 글 삭제 시도(가능 시) → 목록으로 가지 않고 상세 페이지에 머무르며
   빨간 에러 배너 "삭제에 실패했습니다. 권한을 확인해 주세요" 표시.
4. **비로그인**: 세션 없이 삭제 액션 호출 → `/login?returnTo=...` redirect.
5. 이슈의 테스트 글 `/boards/free/edb45a73-4192-4059-8f2f-9c81a3449ca1` 을 최종 삭제해
   목록·직접 URL에서 사라지는지 확인(이슈 본문 요구).

## 리뷰 포인트

- **재조회 검증 방식이 핵심 결정**이다. `.select("id")` 행 수 방식 대신 재조회를 택한 근거
  (posts_select가 deleted_at is null을 요구 → soft-delete 행이 RETURNING에서 사라짐)가
  타당한지, 특히 실제 Supabase 환경에서 **본인 글 1회 삭제로 성공 경로가 에러 없이
  목록으로 가는지** 실증 확인해 주면 좋겠다. (내가 직접 DB를 못 돌려본 부분)
- `stillVisible` 재조회의 모호성 한 가지: 존재하지 않는 임의 `postId`로 액션을 직접 호출하면
  `stillVisible`이 null이라 "성공"으로 판정되어 목록으로 redirect된다. 삭제 버튼은 로드된
  본인/admin 글에만 렌더되고, 존재하지 않는 글에 대한 no-op redirect는 무해(RLS가 타인 글
  실삭제는 차단)하다고 판단해 별도 가드를 두지 않았다. 의견 환영.
- 범위 제외 준수: `deleteComment`의 동일한 silent-fail 패턴은 건드리지 않았다(후속 이슈 권장).
