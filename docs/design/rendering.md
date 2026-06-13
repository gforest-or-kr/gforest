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
| 글 상세 `/boards/[slug]/[postId]` (공개 게시판) | **ISR(●)** `revalidate=300` | 내용이 거의 안 바뀜 → 정적 + 5분 재생성. 목록→글 soft-nav 중앙값 928ms→110ms |
| 글 상세 (권한 게시판) | 동적(ƒ) | 읽기 권한 검사에 쿠키가 필요 → 의도적으로 동적 (`fetchPostDynamic`) |
| 게시판 목록 `/boards/[slug]` | 동적(ƒ) | `searchParams`(페이지·검색) 의존 |
| 글쓰기/수정/관리/마이페이지 | 동적(ƒ) | 인증·폼 |

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
