verdict: pass

# review: #19

## Acceptance Criteria 판정

- [x] `lib/supabase/public.ts` 신규 + `lib/menu-data.ts`가 import — `lib/supabase/public.ts:5`에 `publicClient` export, `lib/menu-data.ts:3`에서 import. 로컬 정의·중복 `createClient`/`Database` import 제거됨. `getMenuData` 본문은 동일 클라이언트를 그대로 사용해 메뉴 렌더 회귀 없음.
- [x] `lib/boards.ts`의 `getBoardMeta`·`getPublicBoardList`가 `unstable_cache`로 래핑, 쿠키/헤더 미사용 — 둘 다 `publicClient()`(anon, `persistSession:false`)만 사용하고 `@/lib/supabase/server`의 `createClient`를 import하지 않음. `getBoardMeta` tags `["menu", board:${slug}]`, `getPublicBoardList` tags `[board:${slug}]` — 양쪽 모두 `board:${slug}` 포함 (`lib/boards.ts:21`, `:55`).
- [x] 공개 게시판(검색어 없음)이 캐시 경로로 렌더 — `app/boards/[slug]/page.tsx:57` `if (board.read_roles === null && !q)` 분기에서 `getPublicBoardList` 호출. 2회차는 `unstable_cache` 히트로 목록/공지 쿼리 왕복 제거(키 `["board-list", slug, page]`, TTL 60s).
- [x] 게이트/검색 요청은 RLS 동적 경로로 폴백 — `page.tsx:65` else 분기에서 기존 `createClient()` 기반 목록·공지·검색(`q ? .or(...)`) 쿼리를 그대로 실행. 권한 차단(`canReadBoard`→AccessNotice, `page.tsx:43`)·검색·페이징 로직 동일.
- [x] 작성 시 타 사용자 목록 즉시 반영 — `actions.ts:98` `createPost`가 성공 경로에서 `revalidateTag(board:${slug})` 호출 → 공개 목록 캐시 무효화.
- [x] 수정/삭제 즉시 반영 — `actions.ts:147`(updatePost), `:204`(deletePost)에 `revalidateTag(board:${slug})` 추가, 본문 경로는 기존 `revalidatePath` 유지.
- [x] `createPost`/`updatePost`/`deletePost` 성공 경로의 `revalidateTag` 호출 — 위와 동일, 3개 액션 모두 성공(redirect 직전) 경로에 위치.
- [x] 앱 레벨 권한 분기 신규 추가 없음 + 게이트 데이터 anon 캐시 미유출 — `canReadBoard`는 기존대로 UI 노출용 유지, 신규 권한 분기 없음. `getPublicBoardList`(anon 캐시)는 `read_roles === null`일 때만 호출되므로 게이트 게시판 `posts`는 동적 RLS 경로에서만 조회됨. `getBoardMeta`는 공개 메타(`boards_select` `using(true)`)만 캐시 — `getMenuData`와 동일 패턴.
- [x] `vercel.json` `regions: ["icn1"]` 유지 — diff에 `vercel.json` 없음(미변경).
- [x] Supabase 리전 점검 결과 기록 — `handoff.md` 리뷰 포인트에 기록됨. 단 implementer가 대시보드 접근 불가하므로 "확인 완료"가 아니라 "운영자/워처 확인 필요"로 플래그됨. spec(113–114행)이 리전 마이그레이션을 인프라 작업으로 분리하고 implementer는 플래그만 한다고 명시 → 문서화 요건 충족(아래 비고 참조).
- [~] `npm run build`/lint/tsc 통과 — **이 환경에서 실행 미검증**(implementer·reviewer 모두 npm/tsc가 Bash 허용 목록에 없음). 정적 검토로 타입 정합성 확인: 캐시 경로와 동적 경로의 select 문자열이 글자 단위로 동일(`page.tsx:69` vs `lib/boards.ts:44`)하여 `type ListData = Awaited<ReturnType<typeof getPublicBoardList>>` 공통 타입에 캐스팅 없이 양쪽 대입 가능. `notices`/`posts`/`count` 타입 호환, 검색 분기의 `never[]`도 대입 가능. else 블록 내 `supabase` 스코프 누수 없음(이후 코드는 `rows`/`posts`/`notices`만 참조). → 코드상 결함 미발견이나 **빌드 실행 확인은 watcher 몫**.
- [~] 성능 검증(Slow 4G+CPU 4x, 중앙값 of 3) — **로컬 미수행**(프리뷰/배포 환경 필요). 캐시 히트 시 공개 목록의 Supabase 왕복이 제거되는 구조라 기댓값은 충족이나 실측은 watcher/배포 단계 필요. handoff에 기록됨.

## 지적사항

없음(반려 사유 없음). 코드 변경은 spec의 보수적 범위를 정확히 따르며 명백한 버그·보안·범위 이탈 미발견.

## 비고

사람 승인자가 알아야 할 점 — **승인 전 watcher가 처리/확인해야 하는 2개 항목이 코드 외 사유로 미검증 상태로 남음**:

1. **빌드 미실행**: 이 격리 환경은 `npm`/`tsc`/`eslint`가 Bash 허용 목록에 없어 implementer·reviewer 모두 빌드를 돌리지 못했다. 정적 타입 검토상 결함은 없으나(두 데이터 경로의 select가 동일해 공통 타입 무캐스팅 대입), **watcher가 `npm run build`를 실행해 통과를 확인한 뒤 승인 게이트로 넘길 것**을 권장. 빌드 실패 시 재시도 사유가 된다.

2. **Supabase 리전**: AC는 "점검 결과 기록"을 요구하고 handoff에 플래그가 남았으나, 실제 리전이 `ap-northeast-2`인지는 **대시보드 확인이 필요한 미해결 항목**이다(코드 산출물 아님, spec이 인프라로 분리). 불일치 시 캐시 미스 경로(게이트/검색/본문)에 +1s 지연이 남으므로 운영자가 대시보드에서 리전을 확인해야 한다. 본 캐싱 코드는 리전과 무관하게 공개 게시판에 대해 가치가 있다.

위 2건은 모두 implementer가 이 환경에서 수행 불가능한 작업으로, spec이 명시적으로 사람/인프라에 위임한 항목이다(코드 결함 아님). 따라서 코드 판정은 pass이되, 최종 승인 시 위 검증을 권한다.
