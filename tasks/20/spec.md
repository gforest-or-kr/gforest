# spec: 메인 페이지 초기 로드 경량화 — Pretendard 폰트 서브셋·JS 번들 (#20)

## 요약

모바일(Slow 4G + CPU 4x) 메인 페이지 콜드 로드의 Load가 ~2.9s다. FCP(1.1s)는 양호하므로
**렌더 블로킹이 아니라 초기 다운로드 대역폭 경합**이 문제다. 큰 비용은 두 갈래:

1. **폰트** — `app/layout.tsx`가 `pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css`
   를 전역 import한다. 이 *dynamic-subset* 변형은 한글 unicode-range별로 다수의 서브셋
   파일(각 25~37KB)로 쪼개져 초기 화면에 동시 다운로드된다(이슈 트레이스의 `PretendardVariable.subset.*`).
2. **JS 번들** — 초기 클라이언트 청크 합계 ~170KB(71/63/39KB 등). 어떤 청크가 무엇인지
   계측되지 않은 상태다.

이 작업은 **측정 기반 최적화**다. 본 spec은 (a) before/after 계측 프로토콜, (b) 명백히 이득인
구조 변경(번들 애널라이저 도입, below-the-fold 컴포넌트 동적 분할, 히어로 이미지 우선순위 힌트),
(c) 폰트 전략(두 후보를 같은 throttle에서 측정해 더 나은 쪽 채택)을 규정한다.

> **보수적 해석 / 결정 고정**
> - 이슈의 "개선 방향"은 조사 지시이므로, planner가 **반드시 적용할 변경**과 **측정 후 채택할 변경**을
>   구분해 명시한다. 측정값(목표 Load ≤ 2s)은 환경 의존적이라 implementer가 동일 조건에서
>   before/after 수치를 `tasks/20/handoff.md`에 기록하고, reviewer는 *수치 + 구조 변경*으로 판정한다.
> - **`next/image` 도입은 범위 제외**(#9 spec과 일관). 히어로 `<img>` 우선순위 힌트만 추가한다.
> - **폰트 커스텀 서브셋팅(pyftsubset/glyphhanger 등 빌드 스텝 추가)은 범위 제외** — 유지보수
>   경량화 원칙(CLAUDE.md #5)에 어긋난다. pretendard 패키지가 *기본 제공하는* 변형 안에서 선택한다.

## 계측 프로토콜 (필수 — 변경 전후 동일 조건)

implementer는 변경 **전/후** 각각 아래를 수행해 `tasks/20/handoff.md`에 표로 남긴다.

1. `npm run build` 후 production 모드(`npm start`)로 메인(`/`) 측정. dev 모드 수치 금지.
2. Chrome DevTools 또는 Lighthouse, **Slow 4G + CPU 4x throttle**(이슈와 동일).
3. 기록 지표: **FCP, LCP, Load(load 이벤트), 전송 바이트 합계, 폰트 요청 수, 초기 JS 전송량**.
4. 번들 구성: `ANALYZE=true npm run build`의 `@next/bundle-analyzer` 리포트에서 메인 라우트의
   상위 클라이언트 청크 목록을 캡처(파일명/크기).

## 구현 계획

### 1. `@next/bundle-analyzer` 도입 (분석 도구)

- `@next/bundle-analyzer`를 **devDependency**로 추가.
- `next.config.ts`를 `withBundleAnalyzer`로 래핑하되 `enabled: process.env.ANALYZE === "true"`로
  게이트 — 일반 빌드/배포에는 영향 없음. 기존 `nextConfig` 구조 유지.
- 평소 `next build`·Vercel 배포 동작과 산출물이 바뀌지 않아야 한다(애널라이저는 opt-in).

### 2. 폰트 로딩 최적화 (두 후보 측정 → 채택)

현재: `app/layout.tsx`가 `pretendardvariable-dynamic-subset.css` 전역 import. 목표는 **초기
화면 폰트 요청 수를 줄이고**(대역폭 경합 완화) **FOUT/FOIT를 악화시키지 않는 것**.

implementer는 `node_modules/pretendard/dist/web/variable/`에 실제 존재하는 변형을 먼저 확인한 뒤,
아래 두 후보를 동일 throttle에서 측정해 **전송 바이트와 Load를 모두 고려해** 더 나은 쪽을 채택한다.

- **후보 A (요청 수 최소화)**: 단일 파일 변형(`pretendardvariable.css`, 단일 woff2)으로 교체.
  요청 1건이지만 전송 바이트가 큼(전 글리프). Slow 4G에서 바이트가 늘면 역효과일 수 있음.
- **후보 B (바이트 최소화 + 워터폴 완화)**: dynamic-subset 유지하되, 초기 뷰포트에 필요한
  기본(Latin + 상용 한글) 서브셋 woff2만 `<link rel="preload" as="font" type="font/woff2" crossorigin>`로
  선行 로드하고 나머지는 그대로 지연. 트레일링 서브셋이 Load를 늘려도 `swap`이라 가독성은 블로킹 안 됨.

공통 요건(어느 후보든):
- `font-display: swap`이 적용되는지 확인(pretendard 기본). 적용 안 되면 swap을 강제. FOIT 금지.
- `--font-sans`(`app/globals.css:16`) 폰트 스택은 그대로 유지 — 폴백 체인이 swap 동안 표시됨.
- GFM-30(self-host, 외부 CDN 렌더 블로킹 제거) 의도를 깨지 않는다 — 외부 CDN으로 되돌리지 말 것.
- 채택 근거(두 후보의 측정 수치 비교)를 handoff에 남긴다.

> 단일 파일 변형이 패키지에 없고 dynamic-subset만 존재하면 후보 B로 확정한다(이 경우 A 측정 생략 가능,
> 그 사실을 handoff에 명시).

### 3. JS 번들 분할 — below-the-fold 컴포넌트 동적 import

번들 애널라이저 결과를 근거로 진행한다. **확정 변경**:

- `components/popup-layer.tsx`(`PopupLayer`)를 `app/page.tsx`에서 `next/dynamic`으로 분할.
  팝업은 첫 화면 렌더에 불필요(레이어/바텀시트, 노출 조건 충족 시에만)하므로 초기 청크에서 제거.
  `ssr: false` 허용(팝업은 SEO·초기 마크업 불필요).
- **`HeroSlider`(`components/hero-slider.tsx`)는 동적 `ssr:false`로 바꾸지 말 것** — 히어로 이미지가
  LCP 요소다. `ssr:false`면 이미지가 SSR되지 않아 LCP가 악화된다. SSR 유지.
  (슬라이더의 인터랙션 JS만 분리하고 싶다면 마크업 SSR을 보존하는 방식으로만. 불확실하면 현행 유지.)
- 애널라이저에서 메인 초기 청크의 상위 비용이 위 컴포넌트가 아니라 공유/프레임워크 청크로 확인되면,
  그 사실을 handoff에 기록하고 무리한 분할을 하지 않는다(과한 추상화 지양, CLAUDE.md #5).

### 4. 히어로 이미지 우선순위 힌트 (`components/hero-slider.tsx`)

`next/image` 도입 없이 plain `<img>`에 한해:
- **첫 번째 슬라이드**의 데스크탑/모바일 `<img>`에 `fetchPriority="high"` + `loading="eager"` 부여.
- **두 번째 이후 슬라이드** 이미지는 `loading="lazy"`로 지연(자동롤링 전까지 불필요).
- 레이아웃 시프트 방지용 비율(`aspect-[16/6]`/`aspect-[16/9]`)은 이미 있으므로 유지(CLS 악화 금지).
- 정적 폴백 히어로(슬라이드 0개)에는 변경 불필요.

## Acceptance Criteria

- [ ] `npm run build`가 타입/ESLint 에러 없이 성공한다.
- [ ] 일반 `next build`·배포 산출물이 애널라이저 도입으로 바뀌지 않는다(애널라이저는 `ANALYZE=true`에서만
      동작). `ANALYZE=true npm run build`로 리포트가 생성된다.
- [ ] `app/layout.tsx`의 폰트 로딩이 변경되어, 메인 초기 렌더 시 **폰트 요청 수가 변경 전보다 감소**한다
      (handoff의 before/after 폰트 요청 수로 확인). 외부 CDN으로 되돌리지 않았다(self-host 유지).
- [ ] `font-display: swap`이 적용되어 FOIT(빈 텍스트 대기)가 발생하지 않는다. 폴백 폰트 스택이 유지된다.
- [ ] `PopupLayer`가 `next/dynamic`으로 분할되어 메인 초기 클라이언트 청크에 포함되지 않는다
      (애널라이저 before/after로 확인).
- [ ] `HeroSlider`는 여전히 SSR된다(히어로 이미지가 초기 HTML에 존재). `ssr:false`로 바뀌지 않았다.
- [ ] 히어로 첫 슬라이드 이미지에 `fetchPriority="high"`/`loading="eager"`, 이후 슬라이드에 `loading="lazy"`가
      부여된다.
- [ ] `tasks/20/handoff.md`에 동일 throttle(Slow 4G + CPU 4x), production 빌드 기준 before/after 표
      (FCP·LCP·Load·전송 바이트·폰트 요청 수·초기 JS 전송량 + 애널라이저 상위 청크)가 기록된다.
- [ ] 측정 결과 **Load가 유의미하게 단축**(목표 ≤ 2s)되고 **FCP가 회귀하지 않는다**. 목표 미달 시,
      적용한 변경과 남은 병목·사유가 handoff에 분석되어 있다.
- [ ] 기존 동작 무회귀: 메인 슬라이더 자동롤링·도트 네비, 팝업 노출/닫기, 헤더/위젯 스트리밍(`Suspense`),
      `export const dynamic = "force-dynamic"`가 정상 동작한다.

## 범위 제외

- `next/image` 도입(plain `<img>` 우선순위 힌트만).
- pyftsubset/glyphhanger 등 커스텀 폰트 서브셋 빌드 파이프라인 추가.
- 외부 폰트 CDN 사용(self-host 원칙 GFM-30 유지).
- 메인 외 라우트(게시판·관리자 등)의 번들 최적화 — 본 이슈는 메인(`/`) 초기 로드에 한정.
- `HeroSlider`를 `ssr:false`로 만드는 분할(LCP 악화).
- 폰트 변경에 따른 디자인 토큰/타이포 스케일 변경.
