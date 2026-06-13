verdict: fail

# review: #20

## Acceptance Criteria 판정

- [?] `npm run build` 타입/ESLint 무에러 성공 — **미검증.** node_modules 미설치·reviewer는 git diff/log만 허용되어 직접 빌드 불가. 코드상 명백한 오류는 없으나(신규 `@next/bundle-analyzer` import, 클라이언트 래퍼 타입 추론, subset CSS import) 통과를 확정할 근거 없음.
- [?] 애널라이저 opt-in + `ANALYZE=true` 리포트 — `next.config.ts:6-8` `withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })` 래핑, `package.json`에 devDependency `@next/bundle-analyzer@16.2.9` 추가. 구조 정확(일반 빌드 무영향). 단 **리포트 실제 생성은 미실행/미확인.**
- [x] 폰트 로딩 변경 + 요청 수 감소 + self-host 유지 — `app/layout.tsx:7` `pretendardvariable-dynamic-subset.css` → **`pretendardvariable-subset.css`(단일 woff2)**. dynamic-subset(unicode-range별 다수 요청) → 1요청으로 **요청 수 감소는 구조상 결정적**. 외부 CDN 미사용(GFM-30 유지). **1차 반려 사유(full 1.2MB)는 해소됨**(아래 비고 참조).
- [?] `font-display: swap` / FOIT 없음, 폴백 유지 — 폴백 스택(`--font-sans`)은 그대로. swap은 pretendard 기본이나 `node_modules` 미설치로 `pretendardvariable-subset.css`의 실제 swap 포함 여부 **미확인**(빌드 환경에서 확인 필요).
- [x] `PopupLayer` 동적 분할 — `components/popup-layer-client.tsx`(신규)에서 `nextDynamic(() => import("./popup-layer"), { ssr: false })`, `app/page.tsx:6`이 이를 import. 서버 컴포넌트 `ssr:false` 제약을 클라이언트 경계 래퍼로 우회한 표준 패턴. `popups` props 정합(원본 시그니처와 일치). 초기 클라이언트 청크 제외 — 구조상 충족.
- [x] `HeroSlider` SSR 유지 — `app/page.tsx:7`에서 정적 import, 동적 분할 아님. 충족.
- [x] 히어로 우선순위 힌트 — `components/hero-slider.tsx:56`의 `eager = i === 0`로 첫 슬라이드 데스크탑/모바일 `<img>`에 `fetchPriority="high"`/`loading="eager"`, 이후 `loading="lazy"`(`:66-67,74-75`). `aspect-[16/6]`/`aspect-[16/9]` 비율 유지(CLS 무악화). 충족.
- [ ] before/after 계측 표(Slow 4G+CPU 4x, production) — **미충족.** `handoff.md`의 표(L73-81) 전 칸이 `_측정 필요_` 자리표시자다. FCP·LCP·Load·전송 바이트·초기 JS·애널라이저 상위 청크가 **하나도 기록되지 않음**(폰트 요청 수만 구조적으로 "1" 기입).
- [ ] Load 유의미 단축(≤2s) + FCP 무회귀 — **미충족.** 수치 부재로 판정 불가. 게다가 채택한 subset 단일 woff2가 Slow 4G에서 dynamic-subset의 *초기* 로드(~150–200KB)보다 바이트가 클 가능성을 implementer 스스로 인정(`handoff.md:43-45, 88`)했고, 이 이슈가 정조준한 `Load`(대역폭 경합)에 대한 우열은 **측정으로만 확정 가능**하다고 본문에 명시되어 있다.
- [?] 기존 동작 무회귀(슬라이더·팝업·스트리밍·force-dynamic) — 코드상 회귀 요소 없음. 런타임 미검증.

## 지적사항

이 spec은 본문에서 **"측정 기반 최적화"**임을 명시하고(L5·L14), reviewer가 **"수치 + 구조 변경"으로 판정**하도록 못박았다(L21). 구조 변경 6종은 모두 정확하고 1차 반려의 실질적 결함(폰트 1.2MB)도 해소됐다. **그러나 spec의 핵심 산출물인 계측 수치가 전무**하여 성능 최적화의 효과를 사람 승인자가 검증할 수 없다. 이것이 단독 fail 사유다.

**(유일한 fail 사유) before/after 계측 표 부재 — AC(계측 표)·AC(Load 목표).**
- `handoff.md`의 계측 표가 전 칸 `_측정 필요_`다. spec이 필수로 규정한 production 빌드·Slow 4G+CPU 4x 기준 FCP/LCP/Load/전송 바이트/초기 JS/애널라이저 상위 청크가 하나도 없다. 수치 없이는 "Load 유의미 단축(≤2s), FCP 무회귀"를 판정할 수 없고, 사람이 성능 변경을 신뢰할 근거가 없다.
- 더구나 채택한 subset 변형은 **요청 수(다수→1)는 확실히 줄지만 전송 바이트가 dynamic-subset 초기 로드보다 늘 수 있는** 트레이드오프를 안고 있다(implementer도 인정). 이 이슈의 근본 원인이 "대역폭 경합"(spec L6)인 만큼, **subset이 실제로 Load를 개선하는지 vs 악화시키는지는 측정으로만 가릴 수 있다.** 측정 없이 통과시키면 목표(2.9s→≤2s)와 반대로 갈 위험을 인이 떠안게 된다.

**조치 (코드는 그대로 두고 측정만):**
1. 빌드 환경에서 `npm install → npm run build → npm start`로 production `/` 콜드 로드를 **before(변경 전 커밋, 폰트=dynamic-subset)/after(이 브랜치, subset)** 동일 throttle(Slow 4G+CPU 4x)로 측정해 표를 채울 것.
2. `ANALYZE=true npm run build` 리포트로 PopupLayer가 초기 청크에서 빠졌는지, 폰트 요청 수 감소를 수치로 확인.
3. **만약 subset의 after Load가 dynamic-subset before보다 회귀하면**, handoff의 "되돌리기 절차"(후보 B: dynamic-subset + 상용 서브셋 preload)로 전환하거나, 최소한 그 회귀 수치와 사유를 표/분석에 남겨 사람이 판단하도록 할 것.

**(주의 — 환경 제약 가능성)** implementer는 이 세션에서 npm install/build/start가 권한·샌드박스로 차단됐다고 보고했다(`handoff.md:63-68`). reviewer 역시 빌드 불가다. 이 차단이 인프라성으로 지속된다면 **코드만 다시 고치는 재시도로는 표를 채울 수 없다** — 빌드 가능한 환경 제공(watcher/사람)이나 사람 승인 게이트에서의 직접 측정이 필요한 사안이다. 이 점을 watcher가 인지하고 단순 코드 재시도 반복을 피하길 권한다.

## 비고

- **구조 변경 6종(애널라이저 opt-in, PopupLayer 동적 분할 클라이언트 래퍼, HeroSlider SSR 유지, 히어로 우선순위 힌트, subset 폰트 교체, 폴백 스택 유지)은 spec·CLAUDE.md 원칙에 부합하며 코드 품질상 문제 없음.** 재시도 시 **이 코드는 절대 건드리지 말 것** — 폰트를 또 바꾸면 오히려 회귀를 재유발할 수 있다.
- **폰트 결정은 이번에 타당하다.** 1차 반려는 full(1.2MB) 무측정 채택이 사유였는데, 이번에 subset 단일 파일로 바꿔 "AC(요청 수↓) 충족 + full 대비 바이트 축소"를 동시에 달성했다. AC가 "요청 수 감소"를 명시하므로 후보 B(preload)는 요청 수를 줄이지 못해 AC를 문자 그대로 못 채운다 — implementer가 in-package 단일 파일 변형 중 회귀 위험이 가장 작은 subset을 고른 추론은 합당하다. **남은 것은 이 선택이 실제로 효과가 있는지의 측정뿐.**
- 즉 이번 fail은 "잘못 구현했다"가 아니라 **"spec이 필수로 요구한 측정 증거가 비어 있다"**는 절차적·증거적 미충족이다. 코드 재작업이 아니라 **측정 수행**이 다음 단계다.
