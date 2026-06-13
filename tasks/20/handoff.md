# handoff: #20 (재시도 2)

> 1차 반려(`review.md`) 두 사유에 대한 대응:
> - **지적 1(폰트 후보 A 무측정 채택 → 회귀 위험):** 전 글리프 **full 단일 파일(~1.2MB)** →
>   **subset 단일 파일**로 변경. 단일 요청(AC#3)은 유지하되 바이트는 full 대비 대폭 작다.
> - **지적 2(계측 표 부재):** 이 환경에서 빌드/측정이 불가한 사유를 명확히 하고, spec AC#8 후단
>   "목표 미달/미측정 시 분석" 조항에 따라 **바이트 예산 기반 분석**과 watcher가 채울 표 절차를 남김.
> - 1차에서 통과된 구조 변경 4종(애널라이저 opt-in, PopupLayer 동적 분할, HeroSlider SSR 유지,
>   히어로 우선순위 힌트)은 review 비고대로 **그대로 유지**.

## 변경 파일

- `next.config.ts`: `@next/bundle-analyzer`로 래핑. `enabled: process.env.ANALYZE === "true"`
  게이트 — 일반 `next build`·Vercel 배포에는 영향 없음(opt-in). (1차 그대로, 변경 없음)
- `package.json`: `@next/bundle-analyzer@16.2.9`를 **devDependency**로 추가. (1차 그대로)
- `app/layout.tsx`: 폰트 import를 **`pretendardvariable.css`(full, 후보 A) →
  `pretendardvariable-subset.css`(subset 단일 파일)** 로 변경. ← **이번 재시도의 핵심 변경.**
  self-host 유지(GFM-30), 외부 CDN 미사용.
- `components/popup-layer-client.tsx` (신규, 1차 그대로): `"use client"` 박막 래퍼.
  `nextDynamic(() => import("./popup-layer"), { ssr: false })`.
- `app/page.tsx`: `PopupLayer` import를 `@/components/popup-layer-client`로. (1차 그대로)
- `components/hero-slider.tsx`: 첫 슬라이드(`i===0`) 데스크탑/모바일 `<img>`에
  `fetchPriority="high"` + `loading="eager"`, 이후 `loading="lazy"`. (1차 그대로)

## 핵심 결정

### 폰트: full(A) → **subset 단일 파일**로 교체 (지적 1 해소)

`node_modules/pretendard/dist/web/variable/`(pretendard@1.3.9, lock 확인)가 제공하는 in-package
변형 중 선택지는 세 가지다(커스텀 서브셋팅은 spec 범위 제외):

| 변형 | 요청 수 | 초기 전송 바이트 | AC#3(요청↓) | 지적 1(바이트↑ 회귀) |
|---|---|---|---|---|
| `pretendardvariable-dynamic-subset.css` (변경 전) | 다수(unicode-range별) | 작음(초기 뷰포트 글리프만, ~150–200KB) | ✗(미감소) | — (현행) |
| `pretendardvariable.css` (full, **1차 후보 A**) | **1** | **큼(전 글리프 ~1.2MB)** | ✓ | **✗ 회귀 위험(반려 사유)** |
| `pretendardvariable-subset.css` (**이번 채택**) | **1** | 중간(상용 한글+영문, full보다 훨씬 작음) | ✓ | full보다 안전 |

- **왜 subset인가:** AC#3("초기 폰트 요청 수가 변경 전보다 감소")은 **단일 파일 변형으로만** 문자
  그대로 충족된다(dynamic-subset 유지/preload는 요청 수를 줄이지 않음 → AC#3 미충족). 단일 파일 중
  full(A)은 전 글리프 ~1.2MB로 이슈의 근본 원인인 **대역폭 경합**을 악화시킬 위험이 있어 반려됐다.
  **subset 변형은 단일 요청(AC#3 충족)이면서 상용 한글(KS X 1001 계열)+영문/기호만 담아 full 대비
  바이트가 작다** — AC#3과 지적 1을 동시에 만족하는 유일한 in-package 선택지다.
- **트레이드오프(정직히 기록):** subset의 단일 woff2가 dynamic-subset이 *초기 화면에만* 받던 양보다
  여전히 클 수 있다(아래 "바이트 예산 분석"). 하지만 full(1.2MB)보다는 확실히 작고, `swap`이라
  텍스트 렌더(FCP/LCP)는 블로킹되지 않는다. 정확한 우열은 throttle 측정이 필요(watcher 절차 참고).
- **글리프 커버리지:** subset은 상용 한글 위주라 희귀 음절/한자는 폴백 스택(`--font-sans`,
  `globals.css:16`)으로 렌더된다. 학부모조합 일반 한국어 본문은 사실상 전부 커버되며 `swap` 폴백이
  매끄럽게 처리한다. 운영 중 특정 글자가 폴백 폰트로 보이는 사례가 보고되면 dynamic-subset 복귀를
  검토(아래 "되돌리기 절차").
- **swap/self-host:** pretendard 생성 CSS는 모든 `@font-face`에 `font-display: swap` 기본 포함 →
  FOIT 없음, 폴백 스택 유지. 외부 CDN 미사용(GFM-30 유지).

### PopupLayer `ssr:false` — 클라이언트 래퍼 (1차 그대로, review에서 충족 판정)
`Home`/`Popups`는 서버 컴포넌트라 `next/dynamic`의 `ssr:false`를 직접 못 쓴다(빌드 에러). 표준대로
`"use client"` 박막 래퍼(`popup-layer-client.tsx`)에 동적 import를 두고 page에서 import. 결과적으로
PopupLayer는 초기 클라이언트 청크에서 제외. 팝업은 마운트 후 `useEffect` 전엔 `null`이라 SEO 무영향.

### HeroSlider SSR 유지 (1차 그대로)
히어로 이미지가 LCP 요소 → 동적 분할/`ssr:false` 안 함. `Hero`(서버)에서 그대로 SSR.

## 계측 — 이 implementer 환경에서 실행 불가 (watcher가 확정 필요)

**빌드·번들 애널라이저·throttle 측정을 이 세션에서 실행하지 못했다.** 확인된 환경 제약:
- `node_modules` 미설치(`next`/`pretendard` 모두 부재 — Glob 확인).
- `npm`(install/build/start) 실행이 **권한 차단**(승인 거부 확인).
- `curl`/네트워크가 **샌드박스 차단**(unpkg에서 패키지 CSS 직접 검증도 불가).
- 즉 `npm install → npm run build → npm start → Chrome DevTools/Lighthouse(Slow 4G+CPU 4x)`
  파이프라인 전체를 수행할 수 없다. 코드/설정 변경은 결정적이라 모두 적용했다.

아래 표는 **watcher/reviewer가 빌드 환경에서 채워야 할 자리표시자**다(spec AC#7). before는
변경 전 커밋(`ea989e7` 또는 폰트=dynamic-subset 상태), after는 이 브랜치.

| 지표 | before(dynamic-subset, full 아님) | after(subset 단일 파일) |
|---|---|---|
| FCP | _측정 필요_ | _측정 필요_ |
| LCP | _측정 필요_ | _측정 필요_ |
| Load(load 이벤트) | _측정 필요_ | _측정 필요_ |
| 전송 바이트 합계 | _측정 필요_ | _측정 필요_ |
| 폰트 요청 수 | _다수(서브셋 N건)_ | **1(subset 단일 woff2)** |
| 초기 JS 전송량 | _측정 필요_ | _측정 필요(PopupLayer 제외분만큼↓ 기대)_ |
| 애널라이저 상위 청크 | _ANALYZE 리포트 캡처_ | _ANALYZE 리포트 캡처(PopupLayer 분리 확인)_ |

### 바이트 예산 분석 (측정 대체 근거 — spec AC#8 후단)
측정 없이 판정해야 하는 watcher를 위한 정량 추론:
- **폰트 요청 수:** dynamic-subset은 본문 글리프가 걸치는 unicode-range마다 서브셋 woff2(각 25–37KB)를
  내려받아 초기 화면에 여러 건이 동시 경합한다. subset 변형은 **확정적으로 1건**이다 → AC#3 충족(구조상 결정적).
- **폰트 전송 바이트:** full(A, 반려안)=~1.2MB. subset=상용 글리프만이라 full보다 작다. dynamic-subset의
  *초기* 합(~150–200KB)과의 우열은 콘텐츠 글리프 분포에 의존 → 측정 대상. 핵심은 **반려 사유였던 1.2MB를
  제거**했다는 점.
- **초기 JS:** PopupLayer를 `ssr:false` 동적 분할 → 초기 클라이언트 청크에서 빠진다. 감소폭은 ANALYZE
  리포트로 확정. HeroSlider는 SSR 유지라 LCP 무회귀.
- **Load 목표(≤2s):** 폰트 요청 다중경합 완화(다수→1)와 JS 청크 축소가 Load에 유리하게 작용할 것으로
  예상하나, subset 단일 파일 바이트가 변수다. **목표 달성 여부는 throttle 측정으로만 확정 가능**하며,
  미달 시 잔여 병목은 아래 "잔여 병목" 참고.

### 잔여 병목 (목표 미달 시 분석 — spec AC#8 후단)
1. **subset 폰트 바이트:** Slow 4G에서 단일 subset woff2가 여전히 무겁다면 Load를 끌 수 있다. 측정에서
   확인되면 dynamic-subset + 상용 서브셋 `preload`(후보 B)로 전환(되돌리기 절차). 단 B는 패키지 종속
   파일명 하드코딩이 필요해 유지보수 부담(CLAUDE.md #5)이 크고 AC#3(요청 수↓)을 문자 그대로는 못 채운다.
2. **히어로 이미지:** LCP 요소인 Supabase Storage 공개 URL 원본. `next/image`는 spec 범위 제외라
   우선순위 힌트만 적용했다. 이미지 자체 용량/리사이즈는 별도 이슈(#9) 영역.
3. **`force-dynamic` + Suspense 스트리밍:** 메인은 로그인 의존이라 동적 렌더. 위젯 쿼리 지연은
   대역폭이 아니라 DB 왕복 — 본 이슈(초기 다운로드 경량화) 범위 밖.

## 검증 방법 (watcher)

```bash
npm install                      # @next/bundle-analyzer, pretendard 포함
npm run build                    # AC#1: 타입/ESLint 무에러. subset CSS import·analyzer·클라 래퍼 타입 확인
npm start                        # production / 측정 (dev 금지)
ANALYZE=true npm run build       # AC#2: 애널라이저 리포트(HTML). 메인 라우트 상위 청크, PopupLayer 분리 확인
```
- 측정: Chrome DevTools/Lighthouse **Slow 4G + CPU 4x**로 `/` 콜드 로드. before(폰트=dynamic-subset)/
  after(이 브랜치=subset) 비교해 위 표를 채운다.
- swap 확인: 설치 후 `node_modules/pretendard/dist/web/variable/pretendardvariable-subset.css`에
  `font-display: swap` 포함 확인(pretendard 기본). 누락 시 FOIT → AC#4 위반이니 보고.

코드 단 확인(브라우저 불필요):
- `app/layout.tsx:7` import가 `pretendardvariable-subset.css`(단일 subset)인지, 외부 CDN 아님.
- `components/popup-layer-client.tsx`가 `ssr:false` 동적 분할, `app/page.tsx:6`이 이를 import.
- `components/hero-slider.tsx:66,67,74,75` 첫 슬라이드 `fetchPriority="high"`/`loading="eager"`,
  이후 `loading="lazy"`. `HeroSlider`는 `app/page.tsx:7`에서 정적 import(SSR).

## 되돌리기 절차 (측정에서 subset이 Load 회귀 시에만 — 후보 B)
1. `app/layout.tsx` import를 `pretendardvariable-dynamic-subset.css`로 되돌린다.
2. 설치된 `dynamic-subset` CSS에서 초기 뷰포트 상용 서브셋 woff2 파일명을 확인해(설치 후에만 가능)
   `<link rel="preload" as="font" type="font/woff2" crossorigin>`로 선로드.
   → 이 경우 AC#3(요청 수↓)은 preload 우선순위로 재해석 필요(reviewer 판단). 유지보수 부담↑.

## 리뷰 포인트
1. **폰트 subset 채택.** full(1.2MB, 1차 반려) 대신 subset 단일 파일로 변경해 "요청 1건 유지 +
   바이트 축소"를 노렸다. **측정 가능 환경이면** subset의 실제 woff2 바이트와 Load를 dynamic-subset과
   비교해 적정성 확정 바람. 회귀 시 위 되돌리기(후보 B).
2. **측정 미실행 사유.** `npm`·`curl` 모두 이 세션에서 차단됨(권한/샌드박스). 표는 watcher가 채워야 함.
   spec AC#8 후단(미측정/미달 시 분석) 조항에 따라 바이트 예산 분석으로 갈음했다.
3. **빌드 미실행.** `@next/bundle-analyzer` import, 클라이언트 래퍼 타입 추론, subset CSS import의
   타입/ESLint 통과는 설치 후 watcher가 확정.
4. **subset 글리프 커버리지.** 상용 한글 외 희귀 글자는 폴백 스택 렌더. 일반 본문은 무영향이나
   운영 중 특정 글자 폴백이 보고되면 dynamic-subset 복귀 검토.
