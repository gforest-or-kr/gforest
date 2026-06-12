# spec: 메인 레이어 팝업(공지 팝업) 미구현 — 관리 화면 (#10)

## 요약

검증 결과, 메인 레이어 팝업의 **표시 레이어는 이미 완성되어 있다.** `app/page.tsx`의
`Popups()`가 `popups` 테이블에서 활성·기간 내 팝업을 조회해 `components/popup-layer.tsx`
(D: 중앙 모달 / M: 바텀시트, localStorage 기반 "N일 동안 보지 않기")로 렌더링한다.
`popups` 테이블(마이그레이션 1)·RLS(`popups_admin`/`popups_select`)·타입(`lib/supabase/types.ts`)·
`site` 스토리지 버킷(마이그레이션 4)도 모두 존재한다.

따라서 #10에서 실제로 누락된 것은 **관리자가 팝업을 등록/수정/삭제하고 노출 기간을 설정하는
관리 화면(`/admin/popups`)** 하나뿐이다. 2026-06-13 검증에서 "팝업 없음"으로 보인 것은 DB에
팝업 행이 없었기 때문이며, 관리 화면이 없어 운영진이 행을 추가할 수단이 없는 상태다.

기존 슬라이더 관리 화면(`app/admin/slides/`, #9에서 구현)을 거의 그대로 미러링하되,
팝업 고유 필드인 **노출 기간(`starts_at`/`ends_at`)·다시보지않기 기간(`dismiss_days`)**을
추가한다. 이미지·드래그 기능은 범위에서 제외한다(아래 "범위 제외" 참조).

## 보수적 해석 (이슈의 "결정 필요" 항목 처리)

이슈에 사람 결정 항목이 명시되어 있으나, 역할 지침상 가장 보수적(범위가 작은) 해석을 택하고 명시한다.

- **관리 화면 범위**: 팝업 CRUD + 기간/노출 설정만. 관리자 기능 §4의 다른 항목과 통합 설계하지
  않고, 슬라이더 관리와 동일한 단일 페이지 패턴(`/admin/slides`)을 따른다.
- **"다시 보지 않기" 기간 정책**: 신규 정책을 만들지 않는다. DB가 이미 팝업별 `dismiss_days`
  (1–30, 기본 3)를 가지며 표시 레이어가 이를 사용한다. 관리 화면에서 팝업마다 값을 입력하게 하여
  구 사이트의 "10일/3일" 운영을 그대로 재현한다.
- **드래그 기능**: 구현하지 않는다. 현 표시 레이어는 모바일 퍼스트 중앙 모달/바텀시트이며,
  CLAUDE.md #6(모바일 퍼스트·호버 의존 금지)에 따라 드래그는 부적합하다.

## 구현 계획

### 1. `app/admin/popups/actions.ts` (신규)

`app/admin/slides/actions.ts`를 템플릿으로 한 서버 액션. 권한은 `popups_admin` RLS에 위임하고
액션은 입력 검증만 담당한다(CLAUDE.md #3). 이미지 업로드 로직은 포함하지 않는다.

- `"use server"` 선언. `revalidate()`는 `revalidatePath("/admin/popups")`와 `revalidatePath("/")` 호출.
- `createPopup(formData)`:
  - 입력: `title`(필수, trim), `body`(기본 ""), `link_url`(빈 값 → null), `dismiss_days`(1–30, 기본 3),
    `sort_order`(기본 0), `is_active`(`"on"` 체크박스 → boolean), `starts_at`/`ends_at`(datetime-local 문자열).
  - `title`이 비면 조용히 return(슬라이더 액션과 동일 패턴).
  - `ends_at`이 비어 있거나 `starts_at`보다 빠르면 return(잘못된 기간 거부).
  - `dismiss_days`는 1–30 범위로 clamp 또는 범위 밖이면 기본 3.
  - datetime-local 값(로컬 시간, 타임존 없음)을 timestamptz로 안전하게 저장:
    `new Date(value).toISOString()`로 변환해 insert. 빈 `starts_at`은 컬럼 기본값(now())에 맡기도록
    해당 키를 insert payload에서 생략.
  - `supabase.from("popups").insert({...})`.
- `updatePopup(id, formData)`: 메타데이터 전체 갱신(`title`/`body`/`link_url`/`dismiss_days`/
  `sort_order`/`is_active`/`starts_at`/`ends_at`). `title` 비면 return. `eq("id", id)`.
- `deletePopup(id)`: `supabase.from("popups").delete().eq("id", id)` 후 `revalidate()`.
  (이미지 스토리지 정리 로직 불필요 — 이미지 미사용.)

### 2. `app/admin/popups/page.tsx` (신규)

`app/admin/slides/page.tsx`를 템플릿으로 한 서버 컴포넌트. admin 차단은 `app/admin/layout.tsx`가
이미 보장하므로 별도 가드 불필요.

- `supabase.from("popups").select("id, title, body, link_url, dismiss_days, sort_order, is_active, starts_at, ends_at").order("sort_order")`.
- 목록: 각 팝업을 한 행으로, `updatePopup.bind(null, p.id)` / `deletePopup.bind(null, p.id)` form.
  편집 필드 — 제목(필수), 본문(`textarea`), 링크 URL, 노출 시작(`datetime-local`), 노출 종료(`datetime-local`),
  다시보지않기 일수(`number`, min 1 max 30), 정렬 순서(`number`), 활성(checkbox), 저장/삭제 버튼.
  - `datetime-local` 기본값은 timestamptz를 `YYYY-MM-DDTHH:mm` 형식으로 슬라이스해 주입
    (예: `p.starts_at.slice(0, 16)` — 단, KST 표기를 위해 변환 필요 시 헬퍼로 처리. 단순 slice면
    UTC 기준이 되므로 주의; 최소한 일관되게 입력/출력 모두 같은 기준을 쓸 것).
- 빈 상태: "등록된 팝업이 없습니다 — 아래에서 추가하세요" 안내.
- 하단 "새 팝업 등록" form → `createPopup`. 필드는 위 편집 필드와 동일, 기간/활성 기본값 포함.
- 스타일/클래스는 슬라이더 페이지의 토큰(`input` 상수, forest 팔레트 버튼 등)을 재사용.

### 3. `app/admin/layout.tsx` (수정)

네비게이션에 팝업 관리 링크 추가. 기존 "메인 슬라이더" `<Link>` 옆에 동일 스타일로:

```tsx
<Link href="/admin/popups" className="px-3 py-1.5 rounded-lg hover:bg-forest-50 font-medium">
  메인 팝업
</Link>
```

### 4. 변경하지 않는 것 (이미 동작)

- `components/popup-layer.tsx`, `app/page.tsx`의 `Popups()` — 표시 레이어 그대로 유지.
- `supabase/migrations/*`, `lib/supabase/types.ts` — 스키마/타입 변경 없음(테이블·타입 기존재).

## Acceptance Criteria

- [ ] `app/admin/popups/page.tsx`와 `app/admin/popups/actions.ts`가 신규 생성되어 있다.
- [ ] `/admin/popups` 페이지가 `popups` 테이블의 모든 행을 `sort_order` 순으로 목록 표시한다.
- [ ] "새 팝업 등록" 폼에서 제목·본문·링크·노출 시작/종료·다시보지않기 일수·정렬·활성을 입력해
      생성하면 `popups` 행이 추가되고, 등록 후 목록과 메인(`/`)이 revalidate된다.
- [ ] 각 행에서 위 필드를 수정·저장하면 해당 행만 갱신되고, 삭제하면 행이 제거된다.
- [ ] `actions.ts`에 권한 분기 코드가 없다(권한은 `popups_admin` RLS에 위임 — CLAUDE.md #3).
- [ ] `title`이 빈 생성/수정, `ends_at`이 비었거나 `starts_at`보다 이른 생성은 행을 만들지/바꾸지 않는다.
- [ ] `dismiss_days`는 1–30 범위만 저장된다(범위 밖 입력 시 기본 3 또는 clamp).
- [ ] `app/admin/layout.tsx` 네비게이션에 `/admin/popups`로 가는 "메인 팝업" 링크가 있다.
- [ ] 관리 화면에서 활성·기간 내 팝업을 1개 등록한 뒤 메인(`/`)을 비로그인으로 열면 `PopupLayer`가
      해당 팝업을 노출한다(표시 레이어 회귀 없음).
- [ ] `npm run build`(또는 `tsc`/lint)가 신규/수정 파일에 대해 타입·린트 오류 없이 통과한다.
- [ ] `components/popup-layer.tsx`, `app/page.tsx`, `supabase/migrations/*`, `lib/supabase/types.ts`는
      변경되지 않았다.

## 범위 제외

- **표시 레이어 구현/변경**: 이미 완성·연결되어 있어 손대지 않는다.
- **드래그 가능 팝업**: 모바일 퍼스트 원칙(CLAUDE.md #6)에 따라 미구현. 구 사이트 드래그 기능은 폐기.
- **팝업 이미지 업로드/표시**: `popups.image_path` 컬럼은 존재하나 현 표시 레이어가 렌더링하지 않는다.
  관리 화면에서도 이미지를 다루지 않는다(추가하려면 `PopupLayer`/`page.tsx` 동시 수정 필요 → 별도 이슈).
- **다시보지않기 기간 정책 신설**: 팝업별 `dismiss_days`로 충분. 전역 정책/쿠키 방식 변경 없음.
- **관리자 기능 §4의 다른 항목**(회원·게시판·게시글 관리 등): 본 이슈 범위 밖.
- **스키마/타입 변경**: 불필요(테이블·RLS·타입·스토리지 버킷 모두 기존재).
