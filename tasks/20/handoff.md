# handoff: #20

## 변경 파일

- `next.config.ts`: `@next/bundle-analyzer`로 래핑. `enabled: process.env.ANALYZE === "true"`
  게이트 — 일반 `next build`·Vercel 배포에는 영향 없음(opt-in). 기존 `nextConfig` 구조 유지.
- `package.json`: `@next/bundle-analyzer@16.2.9`를 **devDependency**로 추가(next 버전과 일치).
- `app/layout.tsx`: 폰트 전역 import를 `pretendardvariable-dynamic-subset.css` →
  `pretendardvariable.css`(**단일 파일 변형, 후보 A**)로 교체. self-host 유지(GFM-30), 외부 CDN 미사용.
- `components/popup-layer-client.tsx` (**신규**): `"use client"` 박막 래퍼. `next/dynamic`
  (`nextDynamic`)으로 `popup-layer`를 `ssr:false` 분할.
- `app/page.tsx`: `PopupLayer` import를 `@/components/popup-layer` → `@/components/popup-layer-client`로
  변경. (`export const dynamic = "force-dynamic"`는 그대로 — 래퍼 안에서 `nextDynamic`로 별칭해 이름 충돌 없음.)
- `components/hero-slider.tsx`: 첫 슬라이드(`i===0`) 데스크탑/모바일 `<img>`에
  `fetchPriority="high"` + `loading="eager"`, 이후 슬라이드에 `loading="lazy"`. `aspect-*` 비율 유지(CLS 무변).

## 핵심 결정

### 폰트: 후보 A(단일 파일) 채택 — 측정 없이 결정한 근거
스펙은 후보 A(단일 파일)와 후보 B(dynamic-subset 유지 + preload)를 동일 throttle에서 측정해
채택하라고 했으나, **이 구현 환경에서 측정을 실행할 수 없었다**(아래 "측정 미실행" 참조). 측정 불가
상황에서 다음 근거로 **후보 A**를 채택했다:

1. **하드 AC("초기 폰트 요청 수 감소")를 충족하는 유일한 in-package 선택지다.** dynamic-subset은
   한글 unicode-range별로 다수 서브셋 woff2를 동시 요청한다. 후보 B(preload)는 우선순위만
   재배치할 뿐 **요청 수를 줄이지 않는다** → AC를 문자 그대로 충족 못 함. 후보 A는 단일 woff2 1요청.
2. **유지보수 경량화(CLAUDE.md #5).** 후보 B는 pretendard의 해시/인덱스가 붙은 서브셋 파일명
   (`woff2/PretendardVariable.subset.*.woff2`)을 `<link rel=preload>`에 하드코딩해야 하며 패키지
   버전업 시 깨진다. 후보 A는 안정적인 단일 import 한 줄.
3. **swap 보장.** pretendard `pretendardvariable.css`는 `font-display: swap`을 기본 포함 → FOIT 없음,
   FCP 회귀 없음(폴백 스택 `--font-sans`은 그대로).

> **트레이드오프(반드시 측정으로 확인):** 후보 A의 단일 woff2(전 글리프, ~1.2MB)는 dynamic-subset이
> 초기 화면 글리프만 받던 것보다 **전송 바이트가 늘 수 있다**. Slow 4G에서 바이트 증가가 load 이벤트
> 지연으로 이어지면 Load 목표(≤2s)에 역효과일 수 있다. swap이라 텍스트 렌더(FCP/LCP 텍스트)는 블로킹
> 되지 않지만 load 이벤트는 폰트 다운로드를 포함한다. **reviewer는 throttle 측정에서 전송 바이트·Load를
> 확인**하고, 만약 후보 A가 Load를 회귀시키면 후보 B로 전환을 지시할 것(전환 방법은 "후보 B 전환 절차").

### PopupLayer ssr:false — 클라이언트 래퍼 도입(스펙과의 차이)
스펙은 "`app/page.tsx`에서 `next/dynamic`으로 분할, `ssr:false` 허용"이라 했으나, `Home`/`Popups`는
**서버 컴포넌트**이고 App Router에서 `next/dynamic`의 `ssr:false`는 서버 컴포넌트에서 금지된다
(빌드 에러). 표준 패턴대로 `"use client"` 박막 래퍼(`popup-layer-client.tsx`)에 동적 import를 두고
page에서 그 래퍼를 import했다. 결과적으로 PopupLayer는 SSR되지 않고 초기 클라이언트 청크에서 제외된다
(팝업은 마운트 후 `useEffect`로 큐를 채우기 전엔 `null`이라 SSR 마크업도 불필요 — SEO 영향 없음).
`Popups`(서버)가 직렬화 가능한 `popups` 배열을 props로 넘기는 구조는 유지.

### HeroSlider는 SSR 유지
히어로 이미지가 LCP 요소이므로 `HeroSlider`는 동적 분할/`ssr:false`로 바꾸지 않았다(스펙·AC 준수).
`app/page.tsx`의 `Hero`(서버)에서 그대로 SSR.

## 측정 미실행 — 환경 제약 (reviewer/watcher가 실행 필요)

**이 implementer 세션에서는 production 빌드·번들 애널라이저·throttle 측정을 실행하지 못했다.** 사유:
- 레포에 `node_modules`가 설치돼 있지 않고, 이 세션에서 **`npm`(install/build 등) 실행이 권한 차단**돼
  있다(`npm` 계열·`WebFetch` 모두 승인 거부). 따라서 `npm install` → `npm run build` →
  `ANALYZE=true npm run build` → Chrome DevTools/Lighthouse(Slow 4G+CPU 4x) 측정을 수행할 수 없었다.
- 코드/설정 변경은 결정적이라 모두 적용했으나, **빌드 통과(AC#1)·애널라이저 리포트(AC#2)·
  before/after 수치(AC#8, Load≤2s)는 빌드 환경을 가진 watcher/reviewer가 아래 절차로 확정**해야 한다.

아래 표는 측정 실행 후 채워질 자리표시자다(수치를 채우기 전엔 미검증 상태):

| 지표 | before(dynamic-subset) | after(단일 파일 A) |
|---|---|---|
| FCP | _측정 필요_ | _측정 필요_ |
| LCP | _측정 필요_ | _측정 필요_ |
| Load(load 이벤트) | _측정 필요_ | _측정 필요_ |
| 전송 바이트 합계 | _측정 필요_ | _측정 필요_ |
| 폰트 요청 수 | _측정 필요(다수 서브셋)_ | _측정 필요(단일 woff2 = 1 예상)_ |
| 초기 JS 전송량 | _측정 필요_ | _측정 필요_ |
| 애널라이저 상위 청크 | _ANALYZE 리포트 캡처_ | _ANALYZE 리포트 캡처_ |

> 폰트 요청 수는 구조상 결정적으로 감소한다(다수 unicode-range 서브셋 → 단일 woff2 1건). PopupLayer는
> `ssr:false` 동적 분할로 초기 클라이언트 청크에서 제외된다 — 이 두 가지는 애널라이저 before/after
> 비교로 코드 단에서도 확인 가능.

## 검증 방법

빌드 환경(`node_modules` 설치 가능, Chrome 가용)에서:

```bash
npm install                      # @next/bundle-analyzer 포함 설치
npm run build                    # AC#1: 타입/ESLint 에러 없이 성공 확인
npm start                        # production 모드로 / 측정 (dev 금지)
ANALYZE=true npm run build       # AC#2: .next 애널라이저 리포트(HTML) 생성, 메인 라우트 상위 청크 캡처
```

측정: Chrome DevTools Network/Performance 또는 Lighthouse에서 **Slow 4G + CPU 4x** throttle로 `/`
콜드 로드. before(현재 변경 적용 전 커밋)와 after(이 브랜치)를 동일 조건으로 비교해 위 표를 채운다.

코드 단 확인(브라우저 불필요):
- `app/layout.tsx` 폰트 import가 `pretendardvariable.css`(단일 파일)인지, 외부 CDN 아님.
- `components/popup-layer-client.tsx`가 `ssr:false` 동적 분할인지, `app/page.tsx`가 이를 import하는지.
- `components/hero-slider.tsx` 첫 슬라이드 `<img>`에 `fetchPriority="high"`/`loading="eager"`,
  이후 슬라이드 `loading="lazy"`인지.
- `HeroSlider`가 여전히 정적 import(SSR)인지(`app/page.tsx`).

## 후보 B 전환 절차 (측정에서 A가 Load 회귀 시에만)

후보 A의 woff2 바이트가 Slow 4G에서 Load를 회귀시키는 것으로 측정되면:
1. `app/layout.tsx` 폰트 import를 `pretendardvariable-dynamic-subset.css`로 되돌린다.
2. `app/layout.tsx`의 `<head>`(또는 `metadata`가 아닌 별도 `<link>`)에 초기 뷰포트 상용
   서브셋 woff2를 `<link rel="preload" as="font" type="font/woff2" crossorigin>`로 선로드.
   (단점: 서브셋 파일명이 패키지 버전에 종속 — CLAUDE.md #5 관점에서 A보다 유지보수 부담. 그래서 1순위는 A.)
이 경우 폰트 요청 수 감소 AC는 다른 방식(preload 우선순위)으로 재해석 필요 — reviewer 판단.

## 리뷰 포인트

1. **폰트 A vs B 결정.** 측정 불가로 후보 A를 택했다. 측정 환경에서 전송 바이트/Load를 확인해
   A가 적정한지(특히 1.2MB woff2가 Slow 4G Load를 해치지 않는지) 판정 바람. 회귀 시 위 전환 절차.
2. **`ssr:false` 클라이언트 래퍼.** 서버 컴포넌트 제약 회피용 표준 패턴이나 스펙의 "page에서 직접 분할"
   문구와 형태가 다르다. 의도(초기 청크 제외)는 충족. 빌드가 실제로 통과하는지 확인 바람.
3. **`fetchPriority` 카멜케이스 prop.** React 19에서 `<img fetchPriority>`는 지원되는 DOM 속성이나,
   빌드/ESLint에서 경고 없는지 확인. 데스크탑·모바일 두 `<img>` 모두 첫 슬라이드에 부여(숨김 img 포함 —
   스펙 문구 그대로). 숨김 측 eager 페치가 불필요 트래픽일 수 있으니 측정 시 참고.
4. **빌드 미실행.** 위 환경 제약으로 `npm run build`를 돌리지 못했다. 타입/ESLint 통과는 watcher가
   설치 후 확정해야 한다(특히 신규 `@next/bundle-analyzer` import, 클라이언트 래퍼 타입 추론).
