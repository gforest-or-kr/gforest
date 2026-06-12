verdict: pass

# review: #9

## Acceptance Criteria 판정

- [x] `00000000000003` 프리픽스 파일 하나만 존재 — `ls supabase/migrations/` 결과 `00000000000003_storage_upload_policy.sql` 단 하나. 슬라이드 버킷은 `00000000000004_storage_slides.sql`로 renumber 완료. 코드 내 구 파일명(`00000000000003_storage_slides`) 잔존 참조 없음.
- [~] `npm run build` 성공 — **정적 리뷰로 결함 없음 확인, 실제 실행은 watcher 게이트 필요**(reviewer 권한이 git diff/log만 허용해 빌드 미실행). 신규/수정 코드의 임포트·타입이 모두 정합: `HeroSlider`/`Slide` 임포트(`app/page.tsx:7`), `slides` 테이블 타입이 `lib/supabase/types.ts:362`에 존재하며 명시 `id` insert가 `Insert.id?: string`과 일치, `aria-current`에 boolean 전달은 JSX 타입상 허용. eslint-disable로 `@next/next/no-img-element` 처리됨.
- [~] `supabase db reset` 통과 — **정적 확인만**. migration 4는 `public.is_admin()`(migration 1)·`site` 버킷만 의존하는 단독 적용 가능 SQL, `on conflict do nothing` 사용. 1→2→3→4 의존 충돌 없음. 실제 reset은 watcher가 확인.
- [x] 활성 슬라이드 ≥1 → `HeroSlider` 렌더 — `app/page.tsx` `Hero`가 `is_active=true`를 `sort_order` 순 조회, `slides.length > 0`이면 `<HeroSlider>` 반환.
- [x] 활성 0개 → 정적 폴백 + 슬라이더 에러 없음 — `slides.length === 0`이면 그라데이션 히어로(학교소개 CTA) 반환. `HeroSlider`도 `slides.length === 0`에서 `null` 가드(이중 방어).
- [x] ≥2개 → 5초 자동롤링 + 도트 네비, 탭타겟 44px, `aria-label` — `components/hero-slider.tsx`: `multi`(>1)일 때만 `setInterval(5000)` + cleanup, 도트 버튼 `w-11 h-11`(44px), `aria-label`/`aria-current` 부여.
- [x] `link_url` 있으면 클릭 이동 — slider/admin 목록 모두 `link_url` 있을 때 `<a href>` 래핑, 없으면 평문.
- [x] 비admin `/admin/slides` 리다이렉트 + 내비 링크 노출 — `app/admin/layout.tsx:14-15`가 미로그인→`/login`, 비admin→`/` 리다이렉트. 내비에 "메인 슬라이더" 링크 추가됨.
- [x] admin 등록·수정·삭제 + 메인/목록 갱신 — `actions.ts`의 `createSlide`/`updateSlide`/`deleteSlide`, 각 액션 끝 `revalidatePath("/admin/slides")` + `revalidatePath("/")`.
- [x] 비이미지/2MB 초과 거부 + 업로드 실패 롤백 — `checkImage`가 `type.startsWith("image/")`·`size > 2MB` 검증. 2번째 업로드 실패 시 1번째 `remove`, insert 실패 시 두 파일 `remove`로 고아 방지.
- [x] 읽기는 `site` 공개 URL, 쓰기/삭제는 admin만, 앱에 권한 분기 중복 없음 — `getPublicUrl` 사용, migration 4의 `site_admin_{insert,update,delete}` 정책 + `slides_admin` RLS가 강제. 액션은 입력검증·경로만 담당(권한 분기 없음).

## 지적사항

없음 (fail 사유 없음). 구현이 spec 범위·acceptance criteria와 정합한다.

## 비고

- **실행 검증은 사람/워처 게이트에서 반드시 1회 수행 요망**: reviewer 권한이 `git diff/log`로 제한되어 `npm run build`·`supabase db reset`·런타임 동작(업로드/리다이렉트/롤백)을 직접 실행하지 못했다. 코드 정적 리뷰상 빌드·마이그레이션 결함은 발견되지 않았고, 이번 커밋의 실질 변경은 마이그레이션 renumber 한 건이라 빌드 산출물 영향이 사실상 없으나, 승인 전 watcher가 `npm run build`와 `supabase db reset`을 한 번 돌려 confirm할 것.
- 마이그레이션 rename이 `git mv`가 아닌 Write+unlink로 처리됐다. `git diff origin/main...HEAD`에 구 파일(`00000000000003_storage_slides.sql`)이 보이지 않고 신규 파일만 잡히므로 이미 정상 staging된 상태로 판단되나, 커밋 시 `git add -A`로 삭제분까지 포함되는지 확인 권장.
- (범위 외, UX 개선 여지) `createSlide`/`updateSlide`는 검증 실패 시 사용자 피드백 없이 `return`만 한다. spec은 "거부"만 요구하므로 acceptance 충족. 추후 에러 토스트 도입은 별도 이슈로.
- (범위 외) `deleteSlide`는 Storage `remove` 실패를 무시하고 행 삭제를 진행한다. 고아 파일이 드물게 남을 수 있으나 spec 요구사항은 충족.
