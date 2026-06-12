verdict: pass

# review: #10

## Acceptance Criteria 판정
- [x] `app/admin/popups/page.tsx`·`actions.ts` 신규 생성 — git diff에 두 파일 모두 `new file`로 추가됨.
- [x] `/admin/popups`가 `popups` 전체 행을 `sort_order` 순으로 목록 표시 — `page.tsx:11-13` `.select(...).order("sort_order")` 후 `popups.map`으로 전 행 렌더.
- [x] 새 등록 폼이 제목·본문·링크·노출시작/종료·다시보지않기·정렬·활성 입력 → 행 추가 + `/`·`/admin/popups` revalidate — `createPopup`이 `insert` 후 `revalidate()`(둘 다 호출, `actions.ts:9-11`). 폼 필드 전부 존재(`page.tsx:147-180`).
- [x] 행별 수정/삭제 — `updatePopup.bind(null, p.id)`·`deletePopup.bind(null, p.id)`, 각각 `.eq("id", id)`로 단일 행만 갱신/삭제(`actions.ts:46-83`).
- [x] `actions.ts`에 권한 분기 없음 — `createClient()` 통한 RLS 위임만, role 검사·분기 코드 없음(CLAUDE.md #3 준수).
- [x] 빈 title·빈 ends_at·`ends_at < starts_at` 거부 — `createPopup`/`updatePopup` 공히 `if (!title) return` / `if (!endsAt) return` / `if (startsAt && endsAt < startsAt) return`(ISO 문자열 사전식 비교, 동일 포맷이라 정합).
- [x] `dismiss_days` 1–30 clamp — `clampDismiss`가 `Math.min(30, Math.max(1, n))`, 비숫자 기본 3. DB CHECK와 이중 안전.
- [x] 네비에 "메인 팝업"(`/admin/popups`) 링크 — `layout.tsx:31-36`, 슬라이더 링크와 동일 스타일.
- [x] 표시 레이어 회귀 없음 — KST 입력을 `localToIso`로 UTC ISO 저장, `app/page.tsx:197-203`의 `Popups()`가 `new Date().toISOString()`(UTC) 기준 `lte starts_at`/`gte ends_at` 비교 → 저장 기준과 일치. 활성·기간 내 팝업이 그대로 노출됨.
- [x] 신규/수정 파일 타입·린트 — 빌드를 직접 실행하진 못했으나(리뷰 역할 Bash 제약: git diff/log 한정) 정적 검증으로 타입 정합 확인: `popups` Row의 `body`/`starts_at`/`ends_at`는 non-null이라 `p.body`·`isoToLocal(p.starts_at|ends_at)` 안전, Insert의 `starts_at?`는 optional이라 `...(startsAt ? {starts_at} : {})` 스프레드 정상. 명백한 타입/린트 오류 없음.
- [x] `components/popup-layer.tsx`·`app/page.tsx`·`supabase/migrations/*`·`lib/supabase/types.ts` 미변경 — `git diff --name-only` 결과 표시 레이어/스키마/타입 파일 0건.

## 지적사항
없음. criteria 미충족·실질 결함 없음.

## 비고
- **빌드 미실행**: 리뷰어 환경의 Bash가 git diff/log로 제한되어 `npm run build`를 실제 실행하지 못했다. 위 타입 정합은 육안·타입정의 대조로만 확인했으니, watcher 단계의 CI 빌드 통과를 최종 게이트로 신뢰하면 된다.
- **KST 타임존 처리는 spec 요구(입출력 일관)를 초과해 정확도를 높인 선택**(`localToIso` +09:00 파싱 ↔ `isoToLocal` +9h slice 왕복). 저장이 UTC라 `Popups()`의 UTC 비교와 정확히 맞물려, 운영진이 입력한 KST 종료시각에 만료된다. 회귀 위험 없음.
- 사소한 엣지(빈 문자열/누락 `dismiss_days` 입력 시 `Number("")=0`→clamp 1로 저장, 기본 3 아님)가 있으나 모두 1–30 유효범위 내이고 폼에 `defaultValue`가 있어 실사용에서 발생하지 않는다. 반려 사유 아님.
