verdict: pass

# review: #8

## Acceptance Criteria 판정

- [x] `00000000000003_*.sql` 존재 + storage insert/delete 정책 — `attachments_insert_own`(`bucket_id='attachments'` + `foldername[1]=auth.uid()` + `current_app_role() <> 'pending'`), `attachments_delete_own`(본인 uid 폴더) 모두 생성. `00000000000002`가 예고한 정책과 일치. `current_app_role()`은 initial_schema:27에 존재하는 기존 함수 재사용 (comments_insert와 동일 패턴).
- [x] 글쓰기 폼에 `input[type=file]`(multiple) 렌더 — `components/attachment-field.tsx`의 `<input type="file" multiple>`, `write/page.tsx:80`에서 `<form>` 내부 `<textarea>` 아래 추가.
- [x] 브라우저 직접 업로드 (`{user.id}/` 경로) — `attachment-field.tsx`: `supabase.storage.from("attachments").upload(`${user.id}/${crypto.randomUUID()}.${ext}`, ...)`. 서버 액션엔 메타 JSON만 전달. 가시 file input은 `handleChange`에서 즉시 `value=""`로 비워 폼 제출 시 바이너리가 서버 액션으로 가지 않음.
- [x] 장변 1600px 초과 JPEG/PNG/WebP 리사이즈 — `maybeResize`: `RESIZABLE=["image/jpeg","image/png","image/webp"]`, `createImageBitmap`+canvas로 장변 `MAX_EDGE=1600` 축소 후 동일 포맷 재인코딩. gif 제외, 실패 시 원본 폴백. 검증은 리사이즈 후 바이트 기준.
- [x] 10MB 초과·블록리스트 확장자 클라이언트 거부 + 사유 표시 — `validateFile`로 검사, 실패 파일은 건너뛰고 `errors`에 사유 push해 빨간 텍스트로 표시. 블록리스트에 `exe` 등 16종 실행파일 포함.
- [x] 등록 전 개별 삭제 + Storage 객체 제거 — `remove(path)`: `storage.from("attachments").remove([path])` 후 목록에서 필터. 각 항목에 "삭제" 버튼.
- [x] `attachments` 테이블 행 생성 (전 필드) — `createPost`에서 post insert 성공 후 `post_id`·`uploader_id`·`storage_path`·`file_name`·`byte_size`·`mime_type` 일괄 insert. 객체 형태가 `lib/supabase/types.ts`의 `attachments.Insert`(byte_size/file_name/mime_type/post_id/storage_path/uploader_id 필수)와 정확히 일치.
- [x] 서버 액션 재검증 (개수·크기·확장자·uid 프리픽스) — `parseAttachments`: JSON 파싱 → 타입 가드 + `storage_path.startsWith(`${userId}/`)` + `0 < byte_size <= MAX_FILE_SIZE` + `validateFile() === null` 필터 후 `.slice(0, MAX_FILE_COUNT)`.
- [x] 상세 페이지 이미지 미리보기 / 비이미지 링크 — `[postId]/page.tsx:58` select에 `mime_type` 추가, `mime_type?.startsWith("image/")`면 서명 URL `<img>`(`max-w-full h-auto rounded-xl`, `loading="lazy"`) + 기존 다운로드 링크 유지. 비이미지는 링크만.
- [x] 무첨부 회귀 없음 — `parseAttachments`는 빈 문자열/미존재/비배열에 `[]` 반환, `files.length > 0` 가드로 insert 스킵. 기존 redirect 흐름 불변.
- [x] 권한 분기 중복 없음 (원칙 3) — 업로드는 storage 정책, 행 삽입은 기존 `attachments_insert` RLS(본인 글 + 본인 업로드)가 강제. 앱 코드는 형식 검증만 수행. `lib/attachments.ts`를 클라이언트/서버가 공유.
- [x] `npx tsc --noEmit` 통과 — (주: 이 리뷰 환경의 Bash가 git 외 명령을 차단해 직접 실행하지 못함). 정적 검증으로 갈음: ① insert 객체가 생성 타입 `attachments.Insert`와 완전 일치, ② `post`/`user`는 redirect(`never`) 직후 non-null 내로잉, ③ `React.ChangeEvent` 무(無)import 사용은 `app/signup/page.tsx`·`app/layout.tsx` 등 이미 컴파일되는 기존 파일들과 동일 패턴(Next.js 글로벌 React 타입), ④ DOM API(`createImageBitmap`/`canvas.toBlob`/`crypto.randomUUID`)는 tsconfig `lib:["dom",...]` 범위 내. 타입 오류 소지 없음.

## 지적사항

없음 (criteria 전 항목 충족).

## 비고

사람 승인자가 알아두면 좋은 점:

- **tsc 미실행**: 위 #11 항목대로 본 환경에서 타입체크를 직접 돌리지 못했다. 정적 대조로 통과를 확신하나, watcher/CI에서 `npx tsc --noEmit`(또는 `npm run build`) 한 번 확인되면 완전하다.
- **고아 파일**: 업로드 후 글을 등록하지 않고 이탈하거나, 쓰기 권한 없는 member가 Storage에만 올리는 경우(글 연결 실패) Storage에 객체가 남는다. spec에서 주기적 정리를 후속 이슈로 명시 분리한 부분이라 이번 범위 밖. 무료 티어 1GB 한도 관리 차원에서 추적 권장.
- **업로드 시점 권한 경계**: insert 정책은 "본인 폴더 + pending 아님"까지만 막고, 게시판별 쓰기 권한은 글 생성 시 `attachments_insert` RLS가 최종 강제하는 설계다. 글이 없는 업로드 시점엔 게시판 쓰기 권한을 검사할 수 없으므로 합리적이며 원칙 3과 부합한다.
- **수정 폼/인라인 이미지/댓글 첨부**는 spec의 범위 제외 항목으로, 이번 변경에 포함되지 않은 것이 정상이다.
