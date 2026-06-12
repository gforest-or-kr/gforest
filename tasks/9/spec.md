# spec: 메인 이미지 슬라이더 미구현 (#9)

## 요약

메인 페이지(`app/page.tsx`)의 히어로 영역에 구 사이트(Camera 슬라이더 6장 + 배너별 링크)를
대체하는 이미지 슬라이더를 구현한다. 슬라이드 콘텐츠(이미지·제목·링크·노출순서·활성여부)는
**관리자 화면에서 교체**하는 방식으로 관리한다 — 코드/스토리지 직접 관리가 아니라 admin UI.
이는 이미 스키마(`public.slides` 테이블, migration 1)와 체크리스트 §4(슬라이더 교체 P0)에
반영된 설계이며, 본 spec은 이 가장 보수적인 해석을 채택한다.

데이터 모델은 `public.slides` 테이블(이미 존재), 이미지는 공개 Storage 버킷 `site`에 보관한다.
슬라이더는 라이브러리 없이 CSS scroll-snap + 자동롤링으로 구현하며(스택 원칙 5: 단순함 유지),
활성 슬라이드가 0개면 정적 폴백 히어로를 보여준다.

> **이슈의 "결정 필요" 항목 처리**
> - *관리 방식*: 관리자 화면 교체 방식으로 확정 (스키마·체크리스트와 일치).
> - *초기 콘텐츠 6장의 출처·교체 주기*: **코드 작업 범위 밖**(운영 데이터 입력 사항). 이번 이슈는
>   "관리자가 6장을 등록·교체할 수 있는 기능"까지만 구현한다. 시드 더미 슬라이드는 넣지 않으며,
>   슬라이드 0개일 때 정적 폴백이 보이는 것으로 빈 상태를 처리한다.

## 현재 작업 트리 상태 (중요)

이 이슈에 해당하는 구현이 이미 작업 트리에 미커밋 상태로 존재한다. implementer는 백지에서
새로 만들지 말고 아래 파일들을 **검토·완성·정합성 확인**하는 방향으로 진행한다.

- `M app/page.tsx` — `Hero` 서버 컴포넌트에서 활성 슬라이드 조회 → `HeroSlider` 렌더, 0개면 폴백
- `M app/admin/layout.tsx` — 관리자 내비에 "메인 슬라이더"(`/admin/slides`) 링크 추가
- `?? components/hero-slider.tsx` — 클라이언트 슬라이더(scroll-snap, 자동롤링 5s, 도트 네비)
- `?? app/admin/slides/page.tsx` — 슬라이드 목록/수정/삭제 + 신규 등록 폼
- `?? app/admin/slides/actions.ts` — `createSlide`/`updateSlide`/`deleteSlide` 서버 액션
- `?? supabase/migrations/00000000000003_storage_slides.sql` — `site` 공개 버킷 + admin 쓰기 정책

## 구현 계획

### 1. 마이그레이션 파일명 충돌 해결 (필수 수정)

`00000000000003_storage_slides.sql`(신규)과 기존 `00000000000003_storage_upload_policy.sql`이
**같은 prefix `00000000000003`을 공유한다.** 마이그레이션 적용 순서가 불안정해지므로 신규 파일을
`supabase/migrations/00000000000004_storage_slides.sql`로 **renumber(파일명 변경)** 한다.
파일 내용은 변경 불필요(`public.is_admin()`·`site` 버킷만 의존, 단독 적용 가능).

### 2. DB 스키마 — 변경 없음

`public.slides`(migration 1, line 236)와 RLS(`slides_select` 공개 읽기 / `slides_admin` admin 전체)는
이미 존재하므로 **추가 스키마 변경 없음**. 컬럼: `title, subtitle, link_url, image_desktop_path,
image_mobile_path, sort_order, is_active`. `lib/supabase/types.ts`에 `slides` 타입이 이미 반영되어
있는지 확인하고, 없으면 `supabase gen types typescript`로 재생성한다(스택 원칙 2).

### 3. Storage — `site` 공개 버킷 (migration 4)

- `site` 버킷: `public = true`, `file_size_limit = 2MB`(2097152). 슬라이드는 비로그인 포함 전원에게
  노출되므로 공개 버킷 + 공개 URL이 적절(서명 URL 불필요).
- 정책: `site_admin_insert/update/delete` — `public.is_admin()`만 쓰기 허용. 읽기는 공개 URL이라 select
  정책 불필요. (현재 작성된 내용 그대로 유지)

### 4. 슬라이더 컴포넌트 `components/hero-slider.tsx` (client)

- 라이브러리 미사용. `flex + overflow-x-auto + snap-x snap-mandatory`로 가로 스와이프.
- 슬라이드 2개 이상일 때만 `setInterval` 자동롤링(5초), cleanup 필수.
- 도트 네비: 탭 타겟 44px(`w-11 h-11`), `aria-label`/`aria-current` 부여(접근성, CLAUDE.md #6).
- 데스크탑(`16/6`)·모바일(`16/9`) 이미지를 `sm:` 분기로 각각 출력. `link_url` 있으면 `<a>`로 래핑.
- 0개면 `null` 반환(폴백은 `page.tsx`가 담당).

### 5. 메인 페이지 `app/page.tsx`

- `Hero` 서버 컴포넌트: `slides`에서 `is_active = true` 행을 `sort_order` 순으로 조회 →
  `image_*_path`를 `site` 버킷 공개 URL로 변환해 `HeroSlider`에 전달.
- 활성 슬라이드 0개면 기존 정적 그라데이션 히어로(학교소개 CTA)로 폴백.
- `Suspense`로 감싸 스트리밍(기존 구조 유지).

### 6. 관리자 화면 `app/admin/slides/`

- `page.tsx`: 슬라이드 목록(썸네일 + 제목/부제/링크/순서/활성 인라인 수정 폼, 삭제 버튼) +
  신규 등록 폼(제목*·부제·링크·순서·데스크탑 이미지*·모바일 이미지*).
- `actions.ts` 서버 액션:
  - `createSlide`: 입력 검증(제목 필수, 이미지 형식·2MB 이하) → 두 이미지를 `site/slides/{id}-d|m.ext`로
    업로드 → `slides` insert. 중간 실패 시 업로드한 파일 롤백(remove).
  - `updateSlide`: 메타데이터(제목·부제·링크·순서·활성)만 갱신, 이미지 path 유지.
  - `deleteSlide`: Storage 파일 삭제 후 행 삭제.
  - 모든 액션 완료 후 `revalidatePath("/admin/slides")` + `revalidatePath("/")`.
- 권한 분기를 액션에 중복 구현하지 않는다(CLAUDE.md #3). 차단은 `app/admin/layout.tsx`의
  admin 리다이렉트 + `slides_admin` RLS + `site_admin_*` Storage 정책이 강제.

### 7. 이미지 처리 메모 (implementer 판단 지점)

CLAUDE.md #8은 "클라이언트 리사이즈 후 업로드"를 원칙으로 한다. 현재 슬라이더는 admin이 사전 크롭한
1200×450 / 750×420 본을 2MB 제한으로 받는 방식이다. admin 전용·저빈도 작업이고 서버 액션 업로드라
클라이언트 리사이즈를 강제하지는 않되, 2MB 한도 검증은 유지한다. 추가 리사이즈 도입은 범위 제외.

## Acceptance Criteria

- [ ] `supabase/migrations/`에 `00000000000003`로 시작하는 파일이 **하나만** 존재한다(슬라이드 버킷
      마이그레이션은 `00000000000004_storage_slides.sql`로 renumber됨).
- [ ] `npm run build`(또는 `next build`)가 타입 에러·ESLint 에러 없이 성공한다.
- [ ] `supabase db reset`(또는 전체 마이그레이션 적용)이 충돌·에러 없이 통과한다.
- [ ] `slides`에 `is_active = true` 행이 1개 이상이면 메인 페이지에 `HeroSlider`가 렌더된다.
- [ ] 활성 슬라이드가 0개이면 메인 페이지에 정적 폴백 히어로(학교 소개 CTA)가 렌더되고, 슬라이더 관련
      에러가 발생하지 않는다.
- [ ] 활성 슬라이드가 2개 이상이면 5초 자동롤링과 도트 네비게이션이 동작하고, 도트 버튼의 탭 타겟이
      44px 이상이며 `aria-label`이 부여된다.
- [ ] `link_url`이 설정된 슬라이드는 클릭 시 해당 URL로 이동한다(없으면 링크 없이 표시).
- [ ] `/admin/slides`는 admin이 아닌 사용자가 접근 시 리다이렉트되고, 관리자 내비에 "메인 슬라이더"
      링크가 노출된다.
- [ ] admin이 `/admin/slides`에서 슬라이드를 등록(이미지 2종 업로드)·수정(메타)·삭제할 수 있고, 변경
      후 메인(`/`)과 목록이 갱신된다.
- [ ] 슬라이드 등록 시 이미지가 아니거나 2MB 초과면 거부된다. 업로드 중 실패 시 고아 Storage 파일이
      남지 않는다(롤백).
- [ ] 슬라이드 이미지 읽기는 `site` 버킷 공개 URL로 제공되고, 쓰기/삭제는 admin만 가능하다(RLS·Storage
      정책으로 강제, 앱 코드에 권한 분기 중복 없음).

## 범위 제외

- 초기 콘텐츠 슬라이드 6장의 실제 이미지·문구·링크 입력(운영 데이터 작업) 및 시드 더미 데이터.
- 드래그 정렬 UI(순서는 `sort_order` 숫자 입력으로 처리).
- 클라이언트 측 자동 이미지 리사이즈/크롭(2MB 검증만 유지).
- 슬라이드별 노출 기간(시작·종료일) 예약 — 현재 `is_active` 토글만. (필요 시 별도 이슈)
- 트랜지션 효과 고도화(페이드/Ken Burns 등), `next/image` 도입.
- 팝업 공지 관리(#별도, 체크리스트 §1 별건).
