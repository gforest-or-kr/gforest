# gforest-web 렌더링 전략 & ISR 함정 (2026-06-13)

> 어떤 페이지를 정적(ISR)으로, 어떤 페이지를 동적으로 렌더할지의 기준과,
> **반드시 지켜야 하는 규칙 하나**(layout/정적 페이지에서 쿠키를 읽지 말 것)를 정리한다.
> 이 규칙을 어기면 **dev·빌드는 통과하고 프로덕션에서만 500**이 나는, 잡기 어려운 사고가 난다.
> 실제로 한 번 겪었다(아래 8). 근거: 실측은 `docs/research/performance_and_environments.md`.

## 1. 기본 전략 — "정적 셸 + 클라 개인화"

공개 콘텐츠는 정적으로 미리 만들어 엣지 캐시에서 즉시 내보내고(빠름·서버 부하 0),
사용자별로 달라지는 부분(로그인 상태, 역할, 글쓰기 버튼 등)만 **클라이언트에서** 채운다.
유지보수 손이 덜 가고(무료 티어 목표) 체감 속도가 빠른, 현대 App Router의 표준 패턴이다.

| 페이지 | 렌더 | 이유 |
|---|---|---|
| 글 상세 `/boards/[slug]/[postId]` | **정적(●) 셸** | 페이지는 쿠키를 안 읽어 정적. 공개글은 서버 anon으로 풀 렌더(엣지 HIT·전체 prefetch→soft-nav 즉시), 회원글은 본문만 `MemberPostLoader`(클라)가 세션 RLS로 **단일 왕복**에 로드(아래 9·10) |
| 게시판 목록 `/boards/[slug]` | 동적(ƒ) | `searchParams`(페이지·검색) 의존 |
| 글쓰기/수정/관리/마이페이지 | 동적(ƒ) | 인증·폼 |
| 글소개 `/intro/[slug]` | ISR(●) `revalidate=600` | 쿠키 안 읽는 순수 공개 콘텐츠 |

## 2. ⚠️ 절대 규칙 — layout과 ISR 페이지는 쿠키를 읽지 말 것

**`app/layout.tsx`가 포함하는 서버 컴포넌트(특히 `Header`)와, ISR(●)로 만들 페이지의
서버 컴포넌트는 요청 스코프 동적 API를 호출하면 안 된다:**

- `cookies()`, `headers()`
- `getSessionProfile()` / `createClient()`(서버, 쿠키 기반) 등 내부적으로 쿠키를 읽는 함수

layout은 **모든 페이지에 들어간다.** layout이 쿠키를 읽으면 그 layout을 쓰는
**모든 정적 페이지가 동적으로 끌려 내려가고**, ISR(●)로 표시된 페이지는 런타임 정적
생성 시점에 `DYNAMIC_SERVER_USAGE` 에러를 던지며 **500**이 된다.

### 그럼 로그인 상태·역할은 어떻게?

**클라이언트에서 가져온다.** `Header`(서버)는 공개 메뉴 데이터만 가져오고, 개인화는
`HeaderNav`(클라) 안에서 처리한다:

```tsx
// components/header.tsx (서버) — 쿠키 안 읽음
export default async function Header() {
  const { boards, staticPages } = await getMenuData();   // 공개·캐시
  return <HeaderNav boards={boards} staticPages={staticPages} />;
}

// components/header-nav.tsx (클라)
useEffect(() => {
  const supabase = createClient();                       // 브라우저 클라
  const { data } = await supabase.auth.getClaims();      // 로컬 JWT 검증
  // ...역할 기반 메뉴/로그인 UI 확장
}, []);
```

비로그인 메뉴로 먼저 그리고 hydration 후 개인화로 확장하는 게 정상 동작이다.

## 3. 왜 dev에선 안 잡히나 (핵심)

- **`next dev`는 항상 동적 렌더**라 ISR 정적 생성 경로를 타지 않는다 → 규칙 위반이 있어도 200.
- **`next build`도 통과한다** — `generateStaticParams`가 `[]`를 반환하면 빌드 타임엔 글을
  안 만들고, 첫 요청 시(런타임) 생성하다 터지기 때문.
- **Vercel preview는 SSO 보호(401)**라 외부에서 curl 검증이 어렵다.

→ 결국 **프로덕션에서만** 처음 터진다. 그래서 아래 dev 재현법과 CI 게이트가 필요하다.

## 4. dev에서 ISR 오류 재현·진단하는 법

```bash
# 해당 페이지 generateStaticParams가 [] 반환(=ISR ●) 상태에서
npx next build            # ● 로 표시되는지 확인 (○/ƒ 아님)
npx next start            # prod 모드 — dev가 아니라 start 여야 재현됨
curl -i http://localhost:3000/boards/notice/<글ID>   # 200 인지 500 인지
```

500이 나면 자식 요소를 하나씩 제거하며 이분 탐색으로 범인을 좁힌다. 거의 항상
"어딘가 서버 컴포넌트가 쿠키/헤더를 읽고 있다"가 원인이다(layout/Header가 1순위 용의자).

## 5. CI 게이트 — 사람이 잊어도 막아준다

`scripts/isr-smoke.sh` + `.github/workflows/deploy.yml`이 **매 배포 직전**(vercel build와
vercel deploy 사이)에 위 재현법을 자동 실행한다: `next build → next start → 목록에서 첫 글
경로 추출 → 글 상세 200 + 제목 렌더 + DYNAMIC_SERVER_USAGE 부재` 검증. **실패하면 배포가
중단된다**(prod·preview 공통). PR에서도 같은 잡이 돌아 깨진 변경은 머지 전에 걸린다.

게이트는 안전망이지 면죄부가 아니다 — **2의 규칙을 먼저 지키는 게 우선**이다.

## 6. 캐시 무효화 (ISR 글을 수정했을 때)

글 상세는 `getPostDetail`(`unstable_cache`, 태그 `post:<id>`/`board:<slug>`)로 캐시된다.
댓글 작성·삭제·글 수정 서버 액션은 반드시 `revalidateTag('post:<id>', 'max')`를 호출해
캐시를 비운다(`app/boards/[slug]/actions.ts`). **Next 16에서 `revalidateTag`는 2번째 인자
(`'max'`)가 필수**다 — 빼면 빌드가 깨진다.

## 7. 보류한 것 — PPR(cacheComponents)

부분 사전 렌더(PPR)는 "정적 셸 + 동적 구멍"을 더 깔끔히 풀지만, Next 16에서 전면
experimental이고, **권한 게시판 캐싱이 어긋나면 개인정보가 노출될 위험**이 있어
무인 운영 원칙과 충돌한다. 정식 승격 후 재검토한다.

## 8. 사고 기록 (2026-06-13)

글 상세를 force-dynamic→ISR로 바꿔 soft-nav를 928ms→110ms로 줄였으나, **프로덕션에서만
500**이 나 롤백한 적이 있다. dev·로컬 빌드는 정상이라 원인 추적이 어려웠다. createSignedUrl·
unstable_cache·서버액션·`useSearchParams` 전부 무죄였고, 진범은 **`layout.tsx`의 `<Header />`가
`getSessionProfile()`(쿠키)을 호출**한 것이었다(2). Header 개인화를 클라로 분리해 해결했고,
재발 방지로 5의 CI 게이트를 추가했다. 추가 교훈: **배포 실패 시 짧은 간격으로 재트리거하지
말 것** — `concurrency: cancel-in-progress`와 맞물려 Vercel 배포 큐가 꼬여 `vercel deploy`가
hang한다. 복구는 대시보드에서 직전 정상 배포를 Promote.

## 9. 사고 기록 (2026-06-15) — 글 상세 라우트는 `ƒ` 하나로 통일

GFM-47에서 "공개글은 정적(●)·회원글은 동적, **한 라우트가 요청별로 자동 결정**"을 노렸다.
`generateStaticParams(){return []}` + `revalidate` 제거로 되는 줄 알았으나, **회원 게시판 글이
프로덕션에서만 500**이 났다(공개글·로컬 next start·빌드는 전부 정상 — `notice`만 스모크해서
못 잡음). 원인: `generateStaticParams`가 있으면 빌드가 라우트를 **정적(●)으로 확정**하고,
회원글 권한검사의 쿠키 읽기가 런타임 정적 생성 시점에 `DYNAMIC_SERVER_USAGE`를 던진다.
**Next 16 안정판은 한 라우트의 "정적+쿠키동적" 요청별 자동결정을 지원하지 않는다 — 그게
PPR이고 보류 상태다(7).** 해결: `generateStaticParams` 제거 → 라우트 전체 `ƒ`(동적 SSR).
공개글 속도는 `getPostDetail`의 `unstable_cache`(데이터 캐시)로 흡수(prod 직접 TTFB ~0.42s,
정적 HIT 0.43s와 거의 동일). 잃은 것은 공개글 **soft-nav 전체 prefetch**(즉시 전환)뿐 —
이제 `loading.tsx` 스켈레톤 후 ~0.4s. 재발 방지로 스모크에 **멤버 게시판 더미 UUID 경로
비로그인 200** 검사를 추가(`isr-smoke.sh`).

> (이 통일 `ƒ`안은 10에서 다시 `●` 셸+클라 아일랜드로 대체됨 — 공개글 soft-nav 즉시성 회복 위해.)

## 10. 결론 (2026-06-15) — 공개·회원 모두 빠르게: `●` 셸 + 단일 왕복 클라 아일랜드

9의 통일 `ƒ`는 500은 막았지만 공개글 soft-nav 즉시성(전체 prefetch)을 잃었다. "공개·회원
**둘 다** 빠르게"를 위해 최종 구조를 이렇게 잡았다:

- **페이지는 정적(●)** — `board.read_roles`(공개 메타, 쿠키 아님)로만 분기하므로 서버가 쿠키를
  안 읽는다 → 500 없음, 모든 사용자에게 동일 HTML이라 캐시 가능.
- **공개글**: 서버 anon(`getPostDetail`)로 풀 렌더 → 엣지 HIT + RSC 전체 prefetch → soft-nav 즉시.
- **회원글**: 본문만 `MemberPostLoader`(클라)가 브라우저 세션(RLS)으로 가져온다. **핵심은 단일
  왕복** — GFM-46이 느렸던 건 클라 fetch 자체가 아니라 **4단 순차 워터폴**(profile→post→
  댓글·첨부→첨부별 서명URL)이었다. 이를 제거:
  1. 역할·글·댓글·첨부를 **한 번에 병렬**(서로 의존 없음, postId는 URL에서 이미 앎) → 1왕복.
  2. **차단 왕복에서 서명 URL 제거** — 첨부는 `/dl/{id}` 프록시 링크만. 클릭 시 권한확인+서명
     (워터폴 1단 삭제). *(2026-07 갱신: 인라인 이미지는 비차단 2차 왕복의 배치 서명으로 직링크화 — 11 참조.)*
  3. 이전/다음 글만 글의 `created_at`에 의존 → 본문 렌더 **후 비차단** 2번째 왕복으로 채움.

비로그인은 `getClaims`(로컬 JWT, 네트워크 0)로 즉시 권한 안내 — 왕복조차 없다.

**prod 실측**: 공개글 `x-vercel-cache: HIT`(RSC prefetch도 HIT)·회원 셸 200(스켈레톤). 회원 본문은
정적 셸(prefetch로 즉시) 위에서 1왕복으로 도착. 트레이드오프: 회원 본문은 초기 HTML에 없고
JS 하이드레이션+1왕복이 필요(인증 콘텐츠는 공유 엣지 캐시에 담을 수 없는 본질적 한계 — 그건
PPR의 영역, 7에서 보류). 무인운영·단순함 원칙상 미들웨어 분리/RPC보다 이 구조를 채택.

## 11. 2026-07 최적화 3종 (GFM-64·65·66) — 남은 격차 메우기

2026-07 아키텍처 검토에서 확인된 성능 격차 3곳을 메웠다. 10의 구조는 그대로다.

1. **회원 글 인라인 이미지 배치 서명 (GFM-64)**: 회원 글은 클라 fetch라 **HTML 캐시에 서명
   URL이 동결될 일이 없다** — `/dl` 프록시의 존재 이유가 이 경로엔 적용되지 않는다. 그래서
   `MemberPostLoader`의 비차단 2차 왕복(이전/다음 글)에 `createSignedUrls()` 배치 발급을 병렬
   합류시켜, 인라인 이미지를 Storage 직링크로 렌더한다(`PostView`의 `imageUrls` prop). 이미지
   N장당 함수 호출 N회+302 왕복 N회가 사라진다. **공개(ISR) 글은 기존 `/dl` 유지** — 정적 HTML
   동결 제약이 그대로 적용되기 때문. 다운로드 `<a>`도 `/dl` 유지(원본 파일명 disposition·영구 링크).
   서명 실패 시 `/dl`로 폴백(자가 복구). R2 이전 시 presigned GET 배치로 동일 설계 승계.
2. **댓글 낙관적 업데이트 (GFM-65)**: 작성·수정·삭제를 상태에 즉시 반영하고 서버 액션 실패 시
   롤백. 작성은 성공 후 재조회로 임시 id를 실제 행으로 교체(busy 가드가 재조회 중 중복 제출을
   막아 낙관 행 유실 경합 없음). 체감 지연 ~500ms → 0. 권한 강제는 변함없이 서버 액션+RLS.
3. **번들 예산 가드 (GFM-66)**: 회원 글은 콘텐츠 표시가 하이드레이션에 의존하므로(10의
   트레이드오프) **초기 JS 크기가 저사양 모바일 체감을 지배**한다. `isr-smoke.sh`가 회원 글
   초기 HTML의 `<script>` 청크를 실제로 받아 **gzip 전송량 합계를 예산(기본 300KB, 2026-07
   실측 254KB)과 비교**하고 초과 시 배포를 중단한다(빌드 매니페스트가 아닌 실측이라 Turbopack
   등 툴체인 무관). 예산 조정은 `SMOKE_BUNDLE_BUDGET_KB`. 원칙: **회원 경로에 무거운
   라이브러리를 들이지 않는다** — 이 게이트가 그 원칙의 CI 강제판이다.
4. **Supabase preconnect (GFM-67)**: 회원 fetch는 하이드레이션 뒤에 시작되므로 supabase.co
   첫 연결(DNS+TCP+TLS ~100–300ms)이 직렬로 붙었다. `(site)/layout.tsx`의 preconnect 힌트
   2개(CORS fetch용 crossOrigin + `<img>`용 일반 — 커넥션 풀 분리)로 연결 수립을 JS 다운로드와
   병렬화. 첫 방문 콘텐츠 표시 100–300ms 단축.
5. **회원 글 세션 메모리 캐시 (GFM-68)**: 목록↔글 왕복 재방문 시 매번 스켈레톤+1왕복이던
   것을, `MemberPostLoader` 모듈 스코프 Map(SWR: 캐시 즉시 표시 → 같은 fetch가 백그라운드
   재검증) ~20줄로 재방문 0ms화. 키에 uid 포함(계정 전환 시 타인 캐시 노출 방지), 상한 30건
   간이 LRU, 재검증에서 권한 상실·삭제 확인 시 캐시도 무효화. 새로고침이면 모듈째 초기화되는
   휘발성이라 별도 무효화 불필요. **라이브러리(React Query/SWR) 도입은 이 규모에선 여전히
   과함** — 이 캐시가 필요 충분선이다.

> 유지보수 메모: `unstable_cache`(6·10에서 사용)는 Next.js가 `"use cache"` 지시어로 대체를
> 진행 중인 과도기 API다. 사용처가 `lib/boards.ts` 한 곳에 모여 있어 이전은 국소적이지만,
> **Next 메이저 업그레이드 시 가장 먼저 깨질 지점**이므로 업그레이드 체크리스트 1순위로 볼 것.
