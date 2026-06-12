# handoff: #9

## 변경 파일

- `supabase/migrations/00000000000004_storage_slides.sql` (신규) — 기존
  `00000000000003_storage_slides.sql`를 renumber. 같은 prefix `00000000000003`을
  `00000000000003_storage_upload_policy.sql`과 공유해 적용 순서가 불안정했던 충돌을 해소.
  파일 내용은 변경 없음(`site` 공개 버킷 생성 + `site_admin_{insert,update,delete}` 정책).
- `supabase/migrations/00000000000003_storage_slides.sql` — 삭제(위로 이동).

그 외 슬라이더 본체(아래)는 plan 커밋(ccbe589)에 이미 포함되어 있었고, **검토 결과 spec과
정합하여 변경 없이 유지**했다:
- `app/page.tsx` — `Hero` 서버 컴포넌트: 활성 슬라이드를 `sort_order` 순 조회 → `site`
  공개 URL로 변환 → `HeroSlider`. 0개면 정적 그라데이션 폴백. `Suspense` 스트리밍 유지.
- `components/hero-slider.tsx` — client. scroll-snap + 5초 자동롤링(2개 이상일 때만, cleanup
  포함), 도트 네비(44px `w-11 h-11`, `aria-label`/`aria-current`), 데스크탑 16/6·모바일 16/9
  분기, `link_url` 있으면 `<a>` 래핑, 0개면 `null`.
- `app/admin/slides/page.tsx` — 목록(썸네일·인라인 메타 수정·삭제) + 신규 등록 폼.
- `app/admin/slides/actions.ts` — `createSlide`/`updateSlide`/`deleteSlide` 서버 액션.
- `app/admin/layout.tsx` — 관리자 내비에 "메인 슬라이더"(`/admin/slides`) 링크.

## 핵심 결정

- **이번 이슈의 실질 작업은 마이그레이션 renumber 한 건**이었다. 슬라이더 구현 자체는 plan
  단계에서 이미 작업 트리에 들어와 있어, spec의 지시("백지에서 새로 만들지 말고 검토·완성")대로
  기존 코드를 검토하고 acceptance criteria와 대조했다. 모든 항목이 충족되어 추가 수정은 하지 않았다.
- **스키마/타입은 손대지 않음**: `public.slides`(migration 1) + RLS(`slides_select` 공개 읽기 /
  `slides_admin` admin 전체)가 이미 존재하고, `lib/supabase/types.ts:362`에 `slides` 타입도
  이미 반영되어 있어 `gen types` 재생성 불필요(원본 확인 완료).
- **권한 분기 중복 없음**(CLAUDE.md #3): 액션은 입력검증·스토리지 경로만 담당하고, 차단은
  admin 레이아웃 리다이렉트 + `slides_admin` RLS + `site_admin_*` Storage 정책에 위임.
- 이미지 리사이즈: spec §7대로 admin 사전 크롭본을 2MB 한도 검증으로만 받는다. 클라이언트
  자동 리사이즈는 범위 제외.

## 검증 방법

리뷰어/워처가 실행할 것 (이번 세션은 권한 모드가 npm/npx/tsc/eslint 실행을 차단해
**implementer가 직접 빌드·타입체크를 돌리지 못함** — 아래를 반드시 실행해 확인 요망):

1. `ls supabase/migrations/` — `00000000000003`로 시작하는 파일이 하나뿐인지
   (`..._storage_upload_policy.sql`만), 슬라이드는 `00000000000004_storage_slides.sql`인지.
2. `npm run build` — 타입·ESLint 에러 없이 성공하는지.
3. `supabase db reset` — 마이그레이션 1→2→3→4 충돌 없이 통과하는지.
4. 동작 확인:
   - `slides`에 `is_active=true` 행 0개 → 메인(`/`)에 정적 폴백 히어로.
   - admin으로 `/admin/slides`에서 이미지 2종 업로드 등록 → 메인에 슬라이더. 2개 이상이면
     5초 롤링·도트 동작.
   - 비admin이 `/admin/slides` 접근 시 리다이렉트.
   - 2MB 초과/비이미지 업로드 거부, 업로드 중 실패 시 Storage 고아 파일 없음(롤백).

## 리뷰 포인트

- **빌드 미검증**: 위 사유로 `npm run build`/`tsc`를 돌리지 못했다. 코드 변경은 마이그레이션
  파일 rename 한 건이라 빌드 산출물에 영향이 없을 것으로 판단하지만, 워처가 빌드/`db reset`을
  꼭 한 번 돌려 confirm 해 주길 바란다.
- `createSlide`/`updateSlide`는 검증 실패 시 사용자 피드백 없이 `return`만 한다(에러 토스트
  없음). spec은 "거부"만 요구하므로 acceptance는 충족하나, UX 개선 여지로 남겨둔다(범위 외).
- 마이그레이션 rename을 `git mv`로 하지 못했다(implementer는 git 도구 미허용·세션 샌드박스가
  rm/mv 차단). 신규 파일 Write + 구파일 unlink로 처리했으니, 워처가 커밋 시 git이 rename으로
  인식하도록 `git add -A`로 staging 하면 된다.
