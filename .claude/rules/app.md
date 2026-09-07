---
paths:
  - "app/**"
  - "lib/**"
  - "components/**"
  - "proxy.ts"
---
# 앱 코드 규칙 (app/**, lib/**, components/**) — 이유·상세: `docs/conventions/code-patterns.md`, `docs/design/rendering.md`

- 모든 DB 쿼리는 `withUser(userId | null, fn)` 트랜잭션 안에서. 파라미터 쿼리(`$1…`)만, 문자열 조립 금지. `pool.query` 직접 호출은 `lib/auth*.ts` 뿐.
- 권한은 RLS 가 강제한다. 앱에 `if (role === …)` 게이트를 새로 만들지 않는다(UI 노출용만). RLS 거부는 0행 또는 `42501`, unique 충돌은 `pgCode(e) === "23505"` 로 분기해 사용자 메시지로 바꾼다. update/delete 는 `rowCount` 확인.
- `unstable_cache` 콜백 안에서 세션을 읽지 않는다. 공개 데이터는 `withUser(null, …)` + 태그(`menu`, `board:<slug>`, `post:<id>`).
- 쓰기 서버 액션은 성공 후 `revalidateTag(tag, "max")` — 두 번째 인자 `"max"` 필수.
- 클라이언트 컴포넌트는 DB·인증에 접근하지 않는다. 데이터는 props 로 받고, 변경은 서버 액션 호출 → `router.refresh()`.
- 빌드 시점 DB 접근 금지(`generateStaticParams`, 정적 라우트에서 쿼리). CI 는 DB 없이 빌드한다.
- 미디어: `lib/storage.ts` 는 서버 전용. 업로드는 `createUploadUrl()` → presigned PUT, 클라이언트 리사이즈(장변 1600px). 새 업로드 종류를 만들지 않는다. 첨부는 비공개(presignGet 1h), 아바타·슬라이드는 `publicMediaUrl()`.
- UI: 모바일 퍼스트 단일 반응형, 탭 타겟 44px+, 호버 의존 금지, 다크모드 없음(확정), 색은 `app/globals.css` forest 팔레트. 새 라이브러리는 PR 본문에 이유를 쓴다.
- PR 전 `npm run check`. 렌더·데이터 변경은 병합 후 dev 에서 공개 글·회원 글·로그인을 눈으로 확인.
