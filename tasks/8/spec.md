# spec: 글쓰기 폼에 파일 첨부 기능이 없음 (#8)

## 요약

글쓰기 폼(`/boards/<slug>/write`)에 파일 첨부 UI가 없다. 다만 인프라의 상당 부분은 이미 존재한다:
`public.attachments` 테이블·RLS 정책(`00000000000001_initial_schema.sql:190-202, 309-316`),
private `attachments` Storage 버킷(10MB 제한)과 읽기 정책(`00000000000002_storage_attachments.sql`),
게시글 상세 페이지의 첨부 목록·서명 URL 다운로드 렌더링(`app/boards/[slug]/[postId]/page.tsx:131-165`)이 모두 구현돼 있다.

빠진 것은 세 가지다: ① Storage **업로드(insert)·삭제(delete) 정책** (현재 ETL service key만 업로드 가능),
② 글쓰기 폼의 첨부 UI + `createPost` 서버 액션의 attachments 행 삽입, ③ 상세 페이지의 **이미지 미리보기**.

**업로드는 브라우저에서 Supabase Storage로 직접 수행한다** (anon key + 사용자 세션).
서버 액션 경유 업로드는 불가능하다 — Next.js 서버 액션 기본 바디 한도 1MB, Vercel 요청 바디 한도 4.5MB로
10MB 파일을 받을 수 없다. 서버 액션에는 업로드 완료된 파일의 메타데이터(JSON)만 전달한다.
이 방식은 CLAUDE.md 원칙 3(권한은 DB/RLS가 강제)과도 부합한다.

수정 폼은 코드베이스에 존재하지 않으므로(수정 라우트 자체가 없음) 이번 범위에서 제외한다 — 가장 보수적인 해석으로
"글쓰기 폼"에만 첨부를 붙인다.

## 구현 계획

### 1. 신규 마이그레이션: `supabase/migrations/00000000000003_storage_upload_policy.sql`

`attachments` 버킷에 대한 storage.objects insert/delete 정책 추가. 경로 규칙은
**첫 번째 폴더 = 본인 uid** (`{auth.uid()}/{uuid}.{ext}`).

```sql
-- 첨부 업로드: 로그인 + pending 아님 + 본인 폴더({uid}/...)에만 업로드 가능
-- (게시판별 쓰기 권한은 업로드 시점엔 글이 없어 검사 불가 — attachments 행 insert RLS가 최종 강제)
create policy attachments_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_app_role() <> 'pending'
  );

-- 본인 폴더 파일 삭제 허용 (등록 전 첨부 취소용)
create policy attachments_delete_own on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

- `public.current_app_role()`은 initial_schema에 이미 존재하는 함수를 재사용한다 (comments_insert 정책과 동일 패턴).
- `00000000000002`의 주석("업로드는 현재 ETL(service key)만 수행 — 글쓰기 첨부 기능 추가 시 insert 정책 별도 작성")이
  예고한 바로 그 정책이다.
- public 스키마 변경이 없으므로 `supabase gen types` 재생성은 **불필요**하다 (storage 정책은 생성 타입에 포함되지 않음).

### 2. 신규: `lib/attachments.ts` — 클라이언트/서버 공용 상수·검증

- `MAX_FILE_SIZE = 10 * 1024 * 1024` (버킷 `file_size_limit`와 동일), `MAX_FILE_COUNT = 10`
- `BLOCKED_EXTENSIONS`: 실행파일 차단 블록리스트 — 최소 `exe, dll, msi, bat, cmd, com, scr, ps1, vbs, js, jar, sh, php, jsp, apk, app`
- `validateFile(name, size)` 형태의 검증 헬퍼 (확장자 소문자 비교 + 크기) — 클라이언트와 서버 액션 양쪽에서 동일 함수 사용
- 첨부 메타 타입: `{ storage_path: string; file_name: string; byte_size: number; mime_type: string }`

### 3. 신규: `components/attachment-field.tsx` — 클라이언트 컴포넌트 (`"use client"`)

`lib/supabase/client.ts`의 브라우저 클라이언트를 사용. 동작:

- `<input type="file" multiple>` + 선택 즉시 업로드 (업로드 중 상태 표시, 해당 중 등록 버튼과 무관하게 비동기 진행).
  업로드 중에는 폼 제출을 막지 않아도 되지만, 최소한 "업로드 중" 표시는 남길 것.
- 검증: `lib/attachments.ts`의 `validateFile`로 확장자·10MB·최대 10개 검사, 실패 시 해당 파일만 건너뛰고 사유 표시
- **이미지는 업로드 전 클라이언트 리사이즈** (CLAUDE.md 원칙 8): 장변이 1600px를 넘는 `image/jpeg`·`image/png`·`image/webp`는
  canvas로 장변 1600px로 축소 후 같은 포맷으로 재인코딩. `image/gif`는 리사이즈 제외(애니메이션 보존), 그 외 파일은 원본 그대로.
  크기 검사는 리사이즈 **후** 바이트 기준.
- 업로드 경로: `${user.id}/${crypto.randomUUID()}.${ext}` — 스토리지 키에 원본 파일명(한글 등)을 넣지 않는다.
  원본 파일명은 메타데이터(`file_name`)로만 보존 (상세 페이지가 `download={file_name}`으로 사용 중).
- 업로드 성공한 파일 목록 표시(파일명·크기) + 개별 "삭제" 버튼 — 삭제 시 `storage.from("attachments").remove([path])` 후 목록에서 제거
- 업로드 완료 목록을 `<input type="hidden" name="attachments" value={JSON.stringify(메타배열)} />` 하나로 폼에 실어 보낸다
- 스타일은 기존 폼 톤 유지 (forest 팔레트, rounded-xl, 탭 타겟 44px+ — 모바일 퍼스트)

### 4. 수정: `app/boards/[slug]/write/page.tsx`

- `<textarea>` 아래에 `<AttachmentField />` 추가 (페이지는 서버 컴포넌트 유지, 첨부 필드만 클라이언트 컴포넌트)
- 9행 주석(`파일 첨부는 후속`)을 현행화

### 5. 수정: `app/boards/[slug]/actions.ts` — `createPost`

- `formData.get("attachments")`를 JSON 파싱 (없거나 빈 배열이면 기존 동작 그대로)
- 서버측 재검증: 배열 길이 ≤ 10, 각 항목의 `file_name` 확장자 블록리스트·`byte_size` ≤ 10MB·
  `storage_path`가 `${user.id}/` 프리픽스인지 확인 — 위반 항목은 행 삽입에서 제외
- post insert 성공 후 `attachments` 테이블에 행 일괄 insert
  (`post_id`, `uploader_id: user.id`, `storage_path`, `file_name`, `byte_size`, `mime_type`) —
  RLS `attachments_insert`(본인 글 + 본인 업로드)가 최종 강제
- 행 insert 실패는 글 등록을 롤백하지 않는다(글은 이미 생성됨) — 실패해도 redirect는 정상 진행

### 6. 수정: `app/boards/[slug]/[postId]/page.tsx` — 이미지 미리보기

- 첨부 조회 select에 `mime_type` 추가 (59행)
- 첨부 렌더링 블록(131-165행)에서 `mime_type.startsWith("image/")`인 항목은 서명 URL로
  `<img>` 미리보기 렌더(반응형: `max-w-full h-auto rounded-xl`, `loading="lazy"`) + 기존 다운로드 링크 유지.
  비이미지는 기존 링크 그대로.

## Acceptance Criteria

- [ ] `supabase/migrations/00000000000003_*.sql`이 존재하고, `attachments` 버킷 대상 storage.objects **insert 정책**(본인 uid 폴더 + `current_app_role() <> 'pending'`)과 **delete 정책**(본인 uid 폴더)을 생성한다
- [ ] 글쓰기 폼에 `input[type=file]`(multiple)이 렌더링된다
- [ ] 파일 선택 시 브라우저에서 Supabase Storage `attachments` 버킷의 `{user.id}/` 경로로 직접 업로드된다 (서버 액션으로 파일 바이너리를 보내지 않는다)
- [ ] 장변 1600px 초과 JPEG/PNG/WebP 이미지는 업로드 전 장변 1600px로 클라이언트 리사이즈된다
- [ ] 10MB 초과 파일과 블록리스트 확장자(`exe` 등 실행파일)는 클라이언트에서 거부되고 사유가 표시된다
- [ ] 등록 전 첨부 목록에서 개별 파일을 삭제할 수 있고, 삭제 시 Storage 객체도 함께 제거된다
- [ ] 글 등록 시 `attachments` 테이블에 첨부 행이 생성된다 (`post_id`·`uploader_id`·`storage_path`·`file_name`·`byte_size`·`mime_type`)
- [ ] `createPost` 서버 액션이 첨부 메타데이터를 재검증한다 (개수·크기·확장자·`storage_path`의 본인 uid 프리픽스)
- [ ] 게시글 상세 페이지에서 이미지 첨부는 `<img>` 미리보기로, 비이미지 첨부는 기존 다운로드 링크로 표시된다
- [ ] 첨부 없이 글만 등록하는 기존 플로우가 그대로 동작한다 (회귀 없음)
- [ ] `npx tsc --noEmit`(또는 `npm run build`)이 통과한다
- [ ] 앱 코드에 게시판 권한 분기를 중복 구현하지 않는다 — 업로드·행 삽입 권한은 storage 정책과 기존 `attachments_insert` RLS가 강제 (CLAUDE.md 원칙 3)

## 범위 제외

- **수정 폼의 첨부**: 게시글 수정 라우트/폼 자체가 코드베이스에 없다. 수정 기능(+첨부 편집)은 별도 이슈로 분리
- **WYSIWYG 본문 내 인라인 이미지 삽입** (이슈 본문에서 명시 제외)
- **권한 게시판 서명 URL 정책 재검토** (feature_checklist §2 비고) — 현행 1시간 서명 URL 유지, 후속 이슈
- **고아 파일 정리**: 업로드 후 글을 등록하지 않고 이탈하면 Storage에 파일이 남는다. 무료 티어 1GB 한도 관리 차원의 주기적 정리(예: attachments 행 없는 오래된 객체 삭제)는 후속 이슈로 분리
- **댓글 첨부, 드래그앤드롭, 업로드 진행률 바** 등 UX 고도화
- 기존 XE 이관 첨부(ETL) 경로·`legacy_file_srl` 관련 변경 없음
