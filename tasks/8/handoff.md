# handoff: #8

## 변경 파일
- `supabase/migrations/00000000000003_storage_upload_policy.sql` (신규): `attachments` 버킷 storage.objects **insert 정책**(`attachments_insert_own` — 본인 uid 폴더 + `current_app_role() <> 'pending'`)과 **delete 정책**(`attachments_delete_own` — 본인 uid 폴더). 00000000000002가 예고한 정책.
- `lib/attachments.ts` (신규): 공용 상수(`MAX_FILE_SIZE` 10MB, `MAX_FILE_COUNT` 10, `BLOCKED_EXTENSIONS`)·`AttachmentMeta` 타입·`validateFile(name, size)` 검증 헬퍼. 클라이언트와 서버 액션이 동일 함수 사용.
- `components/attachment-field.tsx` (신규, `"use client"`): 파일 선택 → (이미지면 장변 1600px canvas 리사이즈) → 검증 → `attachments` 버킷 `${user.id}/${uuid}.${ext}`로 직접 업로드 → 목록·개별 삭제·"업로드 중" 표시. 업로드 메타 배열을 `<input type="hidden" name="attachments">` 하나로 폼에 실어 보냄.
- `app/boards/[slug]/write/page.tsx`: `<textarea>` 아래 `<AttachmentField />` 추가(페이지는 서버 컴포넌트 유지), 9행 주석 현행화.
- `app/boards/[slug]/actions.ts` — `createPost`: `formData.get("attachments")` JSON 파싱 + 서버측 재검증(`parseAttachments`: 개수 ≤10, 크기 ≤10MB, 블록리스트 확장자, `storage_path`의 본인 uid 프리픽스) 후 글 insert 성공 시 `attachments` 행 일괄 insert. 행 insert 실패는 글 등록을 롤백하지 않음.
- `app/boards/[slug]/[postId]/page.tsx`: 첨부 select에 `mime_type` 추가, `image/*` 첨부는 서명 URL `<img>` 미리보기(`max-w-full h-auto rounded-xl`, `loading="lazy"`) + 기존 다운로드 링크 유지.

## 핵심 결정
- spec을 그대로 따랐다. 큰 차이 없음.
- 업로드는 브라우저 직접 업로드(anon key + 세션). 서버 액션엔 메타 JSON만 전달 — 서버 액션/Vercel 바디 한도 회피 + RLS가 권한 강제(CLAUDE.md 원칙 3).
- 개수 제한은 컴포넌트에서 로컬 `slots` 카운터로 처리(비동기 setState 경합 회피). 서버 액션은 `.slice(0, MAX_FILE_COUNT)`로 최종 방어.
- 이미지 리사이즈는 `createImageBitmap` + canvas `toBlob`(원포맷 재인코딩). gif는 애니메이션 보존 위해 제외. 리사이즈 실패 시 원본 업로드(try/catch). 크기 검증은 리사이즈 **후** 바이트 기준.
- `mime_type`은 빈 문자열일 때 `application/octet-stream`으로 대체 저장(테이블 `mime_type text not null` 충족).
- `<img>`는 서명 URL(외부 동적 host)이라 next/image 대신 `<img>` 사용 + `@next/next/no-img-element` eslint-disable 주석 추가. 상세 페이지 기존 XE 본문도 `[&_img]` 사용 중이라 톤 일치.

## 검증 방법
- 마이그레이션: `supabase db reset`(또는 새 migration 적용) 후 storage.objects에 `attachments_insert_own`/`attachments_delete_own` 정책 생성 확인.
- 글쓰기: `/boards/<slug>/write`에서 "📎 파일 첨부" → 파일 선택 시 네트워크 탭에 Storage `…/object/attachments/{uid}/…` PUT 발생(서버 액션으로 바이너리 안 감). 1600px 초과 이미지는 축소되어 업로드됨. exe·10MB 초과는 거부 사유 표시. "삭제" 클릭 시 Storage DELETE 발생.
- 등록 후 상세 페이지: `attachments` 테이블 행 생성, 이미지 첨부는 `<img>` 미리보기·비이미지는 링크.
- 첨부 없이 등록 → 기존과 동일 동작(회귀 없음).
- **타입체크 미실행**: 이 세션의 Bash가 대화형 승인을 요구해 `npx tsc --noEmit`을 실행하지 못했다. 대신 `lib/supabase/types.ts`의 `attachments.Insert` 타입과 insert 객체 형태를 수기 대조해 일치 확인했다. watcher/reviewer 환경에서 `npx tsc --noEmit`(또는 `npm run build`) 한 번 돌려 최종 확인 바람.

## 리뷰 포인트
- **마이그레이션 insert 정책의 권한 경계**: 업로드 시점엔 글이 없어 게시판별 쓰기 권한을 못 본다. 그래서 "본인 폴더 + pending 아님"까지만 막고, 최종 강제는 `attachments_insert` RLS(본인 글 + 본인 업로드)에 위임했다. 이 설계가 spec/원칙 3과 맞는지 봐 달라. (부작용: 쓰기 권한 없는 member도 Storage엔 파일을 올릴 수 있으나, 글에 연결되지 못해 고아 파일로 남음 — 고아 정리는 spec상 후속 이슈.)
- 동시 다중 선택 시 개수 제한 로컬 카운터 로직(`slots`)의 경계.
- `createImageBitmap`/`canvas.toBlob` 브라우저 호환 — 모던 브라우저 OK, 실패 시 원본 폴백 처리함.
