# handoff: #10

## 변경 파일
- `app/admin/popups/actions.ts` (신규): 팝업 CRUD 서버 액션(`createPopup`/`updatePopup`/`deletePopup`).
  권한 분기 없음 — `popups_admin` RLS에 위임(CLAUDE.md #3). 입력 검증·기간 변환만 담당.
- `app/admin/popups/page.tsx` (신규): `/admin/popups` 관리 화면. 목록(sort_order 순) + 행별 수정/삭제 폼 + "새 팝업 등록" 폼.
- `app/admin/layout.tsx` (수정): 네비게이션에 "메인 팝업"(`/admin/popups`) 링크 추가.

## 핵심 결정
- **타임존: KST(UTC+9) 정합 처리** — spec은 "단순 slice(UTC 기준)라도 입출력 일관"만 요구했으나,
  운영진이 한국시간으로 사고하므로 한 단계 더 정확하게 구현했다.
  - 저장(actions): `datetime-local` 문자열을 `Date.parse(value + ":00+09:00")`로 KST로 해석 → `toISOString()`(UTC)로 저장.
  - 표시(page): UTC ISO에 +9h 후 `.slice(0,16)`로 KST 벽시계 복원(`isoToLocal`). 입력↔표시가 정확히 왕복하며, 서버 TZ에 의존하지 않는다.
  - 따라서 운영진이 "노출 종료 2026-06-20 18:00"으로 입력하면 KST 18시에 정확히 만료된다(메인 `Popups()`의 UTC 비교와 일치).
- **`dismiss_days`: clamp 채택** — 범위 밖 입력을 1–30으로 clamp, 숫자 아니면 기본 3(spec 허용 범위 내). DB CHECK 제약과 이중 안전.
- **노출 시작 비움 허용** — 빈 `starts_at`은 insert에서 키를 생략해 컬럼 기본값 `now()`에 위임. 종료(`ends_at`)는 필수.
- **삭제 버튼** — 행 폼이 단일 form이라 delete를 별도 form으로 둘 수 없어, `formAction={del}` + `formNoValidate`로 처리(title `required`가 삭제를 막지 않도록).
- **이미지 미사용** — `popups.image_path`는 현 `PopupLayer`가 렌더링하지 않으므로 관리 화면에서도 다루지 않음(spec 범위 제외). 따라서 slides actions의 Storage 업로드/정리 로직은 제거됨.

## 검증 방법
1. `npm run build` (또는 `npx tsc --noEmit && npx eslint app/admin/popups`) — **내 환경에서는 명령 승인 제약으로 실행하지 못했으니 리뷰어가 실행 요망.** slides 패턴을 미러링했고 타입은 육안 검증함.
2. admin 계정으로 `/admin/popups` 접속 → 네비에 "메인 팝업" 링크 확인.
3. "새 팝업 등록"에서 제목·노출 종료(미래 시각)·활성 체크 후 등록 → 목록에 추가, `popups` 행 생성 확인.
4. 비로그인으로 메인(`/`) 열기 → 활성·기간 내 팝업이면 `PopupLayer` 노출(D 중앙모달/M 바텀시트).
5. 행에서 제목 수정·저장 → 해당 행만 갱신. 삭제 → 행 제거.
6. 음성 케이스: 제목 빈 채 저장(무변화), 노출 종료 비움(거부), 종료<시작(거부), `dismiss_days`=99 입력 시 30으로 저장.

## 리뷰 포인트
- **insert 스프레드 패턴**: `...(startsAt ? { starts_at: startsAt } : {})` 가 `popups` Insert 타입과 충돌 없이 컴파일되는지(빌드로 최종 확인 필요). starts_at은 Insert에서 optional이라 문제 없을 것으로 판단.
- **KST 변환 헬퍼 왕복 정확성**: `localToIso`(+09:00 파싱) ↔ `isoToLocal`(+9h 후 UTC slice)가 분 단위로 정확히 왕복하는지.
- **표시 레이어 무변경 확인**: `components/popup-layer.tsx`, `app/page.tsx`, `supabase/migrations/*`, `lib/supabase/types.ts` 미수정(요구사항).
