verdict: fail

# review: #20

## Acceptance Criteria 판정

- [?] `npm run build` 타입/ESLint 무에러 성공 — **미검증.** implementer 환경에서 빌드 미실행, reviewer도 git diff/log만 허용되어 직접 확인 불가. 코드상 명백한 오류는 없으나 통과를 확정할 근거가 없다.
- [?] 애널라이저 opt-in + `ANALYZE=true` 리포트 생성 — `next.config.ts` 래핑·`enabled` 게이트·devDependency 추가는 정확(`next.config.ts:5-8`, `package.json:20`, 버전 16.2.9 = next와 일치). 단 **리포트 실제 생성은 미실행/미확인.**
- [x] 폰트 로딩 변경 + self-host 유지 — `pretendardvariable-dynamic-subset.css` → `pretendardvariable.css` 교체(`app/layout.tsx:7`), 외부 CDN 미사용. 단일 woff2 1요청이라 **요청 수 감소는 구조상 성립**. (단 아래 지적 1 참조 — 요청 수는 줄지만 목표 지표가 회귀할 위험.)
- [?] `font-display: swap` 적용 / FOIT 없음 — handoff 주장(pretendard 기본 swap)이나 `node_modules` 미설치로 `pretendardvariable.css`의 swap 포함 여부를 **확인 불가**. 폴백 스택(`--font-sans`)은 유지됨.
- [x] `PopupLayer` 동적 분할로 초기 클라이언트 청크 제외 — `popup-layer-client.tsx`의 `nextDynamic(... , {ssr:false})` 래퍼 + `app/page.tsx:6` import 변경. 서버 컴포넌트 `ssr:false` 제약을 클라이언트 경계 래퍼로 우회한 표준 패턴, props 전달(`popups`) 정합. 구조상 충족.
- [x] `HeroSlider` SSR 유지 — `app/page.tsx`에서 정적 import 유지, 동적 분할 아님. 충족.
- [x] 히어로 첫 슬라이드 우선순위 힌트 — `components/hero-slider.tsx:56,66,75`에서 `i===0`에 `fetchPriority="high"`/`loading="eager"`, 이후 `loading="lazy"`. 데스크탑·모바일 양쪽 적용. 충족.
- [ ] before/after 계측 표(Slow 4G+CPU 4x, production) 기록 — **미충족.** handoff 표가 전부 `_측정 필요_` 자리표시자다. FCP·LCP·Load·전송 바이트·폰트 요청 수·초기 JS·애널라이저 상위 청크 **단 하나도 기록되지 않음.**
- [ ] Load 유의미 단축(≤2s) + FCP 무회귀 — **미충족(미측정 + 회귀 위험).** 수치가 없어 확인 불가일 뿐 아니라, 채택한 후보 A가 이 지표를 **악화시킬 개연성이 높다**(지적 1).
- [?] 기존 동작 무회귀(슬라이더·팝업·스트리밍·force-dynamic) — 코드상 회귀 요소는 안 보이나 런타임 미검증.

## 지적사항

이 spec은 명시적으로 **"측정 기반 최적화"**이며, reviewer는 *수치 + 구조 변경*으로 판정하도록 규정됐다(spec L21). 구조 변경은 대체로 타당하나 **핵심 수치 산출물(AC#7·AC#8)이 전무**하여 성능 최적화의 효과를 인이 검증할 수 없다. 추가로 폰트 결정에 목표 지표 회귀 위험이 있다. 두 가지가 fail 사유다.

**1. (핵심 결함) 폰트 후보 A 채택이 목표 지표(Load/대역폭 경합)를 회귀시킬 위험 — 측정 없이 결정됨.**
- 이슈의 근본 원인은 spec L6에 "렌더 블로킹이 아니라 **초기 다운로드 대역폭 경합**"으로 못박혀 있다. 후보 A(`pretendardvariable.css`)는 전 글리프 단일 woff2(**~1.2MB**, handoff L33도 인정)를 받는다. dynamic-subset이 초기 화면에 받던 양은 서브셋 수 개 × 25~37KB ≈ 150~200KB 수준이다. 즉 **후보 A는 폰트 "요청 수"는 줄이지만 "전송 바이트"를 대폭 늘린다.**
- Slow 4G(실효 ~수십 KB/s)에서 1.2MB 폰트는 수~수십 초 다운로드가 걸리며, `load` 이벤트는 이 폰트 완료를 기다린다. `swap`이라 텍스트 렌더(FCP/LCP)는 안 막히지만, **이 이슈가 정조준한 `Load`(2.9s→≤2s)는 오히려 악화될 개연성이 크다.** 대역폭 경합 완화가 목표인데 1.2MB를 JS와 경쟁시키는 셈이다.
- spec은 바로 이 위험 때문에 **후보 A vs B를 동일 throttle에서 측정해 채택**하라고 요구했다(spec §2, L51-58). 그리고 측정 생략을 허용한 경우는 **"단일 파일 변형이 패키지에 없을 때"뿐**이다(spec L65). 본 건은 단일 파일 변형이 존재하므로 측정이 필수였다. implementer는 "측정 불가 시 A 채택"이라는, **spec에 없는 규칙을 임의 도입**해 가장 회귀 위험이 큰 선택지를 무측정으로 확정했다(handoff L19-37). handoff 스스로 "reviewer가 측정으로 A 적정성 확인" "회귀 시 B 전환"을 요청한 상태(handoff L33-37, 108-109)다 — 즉 본인도 미검증임을 인정한다.
- 조치: (a) 측정이 가능해지면 A/B를 동일 throttle로 측정해 **전송 바이트·Load 둘 다**로 채택을 확정하고 표를 채울 것. (b) 측정이 끝내 불가하면, 대역폭 경합이 근본 원인인 이 이슈에서 무측정 기본값은 **바이트를 키우지 않는 쪽(후보 B: dynamic-subset 유지 + 초기 상용 서브셋 preload)**이 보수적으로 안전하다. 1.2MB 단일 폰트를 무측정으로 ship하지 말 것.

**2. (AC 직접 미충족) before/after 계측 표 부재 — AC#7·AC#8.**
- `tasks/20/handoff.md`의 계측 표(L62-70)가 모든 칸 `_측정 필요_`다. spec이 필수로 규정한 production 빌드·Slow 4G+CPU 4x 기준 FCP/LCP/Load/전송 바이트/폰트 요청 수/초기 JS/애널라이저 상위 청크가 **하나도 없다.** 수치 없이는 "Load 유의미 단축(≤2s), FCP 무회귀"(AC#8)를 판정할 수 없고, 사람 승인자가 성능 변경을 신뢰할 근거가 없다.
- 조치: 빌드/측정 환경에서 `npm install → npm run build → npm start`로 production `/` 콜드 로드를 동일 throttle로 before(변경 전 커밋)/after 비교해 표를 채울 것. `ANALYZE=true npm run build` 리포트로 PopupLayer가 초기 청크에서 빠졌는지, 폰트 요청 수 감소를 수치로 확인할 것.

**3. (확인 권고, 단독 fail 사유 아님) 빌드/swap 미검증.**
- AC#1(빌드 통과)·AC#4(`pretendardvariable.css`의 `font-display:swap` 실제 포함) 모두 `node_modules` 미설치로 미확인. 신규 `@next/bundle-analyzer` import와 클라이언트 래퍼 타입 추론 포함 빌드가 실제 통과하는지, 채택한 단일 변형 CSS가 swap을 포함하는지(미포함 시 FOIT로 AC#4 위반) 측정 시 함께 확인 필요.

## 비고

- 구조 변경 4종(애널라이저 opt-in, PopupLayer 동적 분할 클라이언트 래퍼, HeroSlider SSR 유지, 히어로 우선순위 힌트)은 spec·CLAUDE.md 원칙에 부합하며 코드 품질상 문제 없음. **재시도 시 이 부분은 그대로 두고**, 폰트 결정 재검토(지적 1)와 계측 표 작성(지적 2)에 집중하면 된다.
- 재시도 환경에서도 `npm` 실행이 계속 차단된다면 폰트 무측정 기본값을 보수적(후보 B 또는 최소한 바이트 비증가)으로 조정하고, 측정 미실행 사유와 남은 병목을 handoff에 분석으로 남기는 방향(spec AC#8 후단 "목표 미달 시 분석" 조항)이 차선이다. 다만 그 경우에도 현재처럼 **회귀 위험이 가장 큰 선택지를 무근거로 고른 상태**는 통과시킬 수 없다.
