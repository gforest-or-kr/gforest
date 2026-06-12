# 성능 진단 · dev/prd 분리 · 유료 대안 조합 (2026-06-12)

> 질문: ① dev/prd를 어떻게 구분하나 ② 현 서버리스 조합이 안정성·속도·유지보수에서 최적인가 (체감 속도 저하, 소액 유료 대안 포함).
> 결론 요약: **속도 문제의 주범은 조합이 아니라 앱 구현 2곳 + Hobby 콜드 스타트**다. $0 최적화로 워밍 0.5s→~0.2s, 콜드 스타트는 Vercel Pro($20)가 유일한 직접 해법. 플랫폼 갈아타기(Fly/Cloudflare/Neon)는 서울 리전 부재·운영 부담으로 오히려 후퇴.

## 1. 실측 진단 (prod, 2026-06-12)

| 측정 | 값 | 해석 |
|---|---|---|
| 콜드 스타트 (유휴 후 첫 요청) | **3.2s** | Hobby scale-to-zero — 한산한 시간대 첫 방문자가 맞는 비용 |
| 워밍 후 TTFB | **~0.52s** (간헐 0.24s) | 전 페이지 동일 — 캐시가 전혀 없음 |
| ISR 페이지(/intro/*) | `x-vercel-cache: MISS`, no-store | **ISR이 죽어 있음** |

### 코드 원인 (확인됨)

1. **루트 레이아웃의 Header가 매 요청 `cookies()` 접근** → Next.js가 모든 라우트를 동적 렌더링으로 강제 → ISR·정적 캐시 전멸. 더해서 메뉴 구성용 쿼리 2개(boards/static_pages)가 매 요청 실행
2. **미들웨어 `auth.getUser()`가 매 요청 Supabase Auth 서버 왕복** (~100ms+) — 같은 리전이라도 HTTP 왕복은 공짜가 아님
3. 나머지(~수십 ms)는 함수 실행 + DB 쿼리 자체 — 서울↔서울이라 정상 범위

## 2. $0 최적화 계획 (앱 구현 — 다음 작업 제안)

| # | 조치 | 예상 효과 |
|---|---|---|
| 1 | 메뉴 데이터(boards/static_pages) `unstable_cache` 10분 캐시 | 매 요청 쿼리 2개 제거 (게시판 추가 시에만 갱신 필요) |
| 2 | 미들웨어·Header의 인증을 **로컬 JWT 검증**(`getClaims`)으로 전환 — Auth 서버 왕복 제거 | 요청당 ~100ms+ 절감 |
| 3 | Suspense 스트리밍 — 셸 먼저 그리고 위젯 나중 | 체감 첫 페인트 대폭 개선 |
| 4 | 워밍 핑 — keep-alive 워크플로에 5분 간격 prod 핑 추가 | 콜드 스타트 *빈도* 감소 (제거는 아님 — GitHub cron 지연 한계) |

예상 결과: 워밍 TTFB 0.5s → **0.15~0.25s**, 콜드 스타트 조우 확률 대폭 감소. 비용 0원.

## 3. dev / prd 분리 절차 (현 구성에서 $0)

전제: 스키마가 코드(`supabase/migrations`)이고 배포가 CI라서 분리가 단순하다.

1. **Supabase 2호 프로젝트 생성** `gforest-dev` (Seoul) — Free 슬롯 2개 중 2번째 사용 ⚠️ 개인 실험용 프로젝트와 슬롯 경합 주의
2. **스키마·시드 적용** — 기존 마이그레이션 SQL 그대로 psql 실행 (프리뷰 샘플 데이터도 원하면 `scripts/legacy-preview` 재실행)
3. **Vercel 환경변수 스코프 분리** — `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`를 Production 스코프(현행 prod 값)와 **Preview 스코프(dev 프로젝트 값)** 로 나눔. CI가 `vercel pull --environment=preview`로 이미 환경별로 받아감 — 워크플로 수정 불필요
4. **keep-alive 확장** — dev 프로젝트도 주 2회 핑 대상에 추가 (7일 정지 별도 적용되므로)
5. 끝 — 이후 **PR = preview 배포 + dev DB**, **main = production + prod DB**

현재 "preview도 prod DB를 본다"는 CI/CD 문서의 주의사항이 이걸로 해소된다. 비용 0원, 소요 ~30분.

## 4. 유료 대안 조합 비교 (2026-06 리서치)

핵심 사실들:
- **Vercel "scale to one"(콜드 스타트 제거)은 Pro 전용** — Pro 기준 요청의 99.37%에서 콜드 스타트 0 (공식). Hobby는 Fluid/바이트코드 캐싱은 적용되나 scale-to-zero 유지
- **Supabase Pro($25)**: Micro(1GB, Free의 2배 RAM) + **7일 정지 제거** + 백업 7일. 단 회원 300명 부하에서 쿼리 속도 체감 차는 크지 않을 것(추정)
- **대안 플랫폼은 서울이 없다**: Neon(싱가포르까지만), Fly.io(도쿄까지만 — 서울 미지원), Railway/Render(싱가포르) — 전부 쿼리/요청마다 국제 왕복 추가. Cloudflare Workers는 서울 PoP + 콜드 스타트 0이지만 OpenNext 빌드·캐시 직접 구성(유지보수 원칙과 상충). PlanetScale Postgres가 GCP 서울 베타 + $5로 흥미로우나 Auth/Storage/RLS 재구축 비용이 큼

| 조합 | 월비용 | 콜드 스타트 | 워밍 | 정지 리스크 | 운영 난도 |
|---|---|---|---|---|---|
| ① 현행 + §2 최적화 | **$0** | 빈도 감소(잔존) | **~0.2s** | keep-alive로 방어 | 최저 |
| ② Hobby + Supabase Pro | $25 | 3.2s 그대로 | ~0.2s | DB 정지 없음 | 최저 |
| ③ **Vercel Pro + 현행 DB** | $20 | **~0** | ~0.2s | DB는 keep-alive 방어 | 최저 |
| ④ Vercel Pro + Supabase Pro | $45 | ~0 | ~0.2s | 양쪽 모두 없음 | 최저 |
| ⑤ Fly 도쿄 / CF Workers / Neon 등 | $4~10 | 없음/적음 | +국제왕복 or 구성복잡 | 다양 | 중~중상 |

## 5. 권고

1. **1단계 (지금, $0)**: §2 앱 최적화 + §3 dev/prd 분리 — 워밍 속도는 이걸로 해결된다. *조합을 바꾸기 전에 구현 부채부터 갚는 것이 순서*
2. **2단계 (체감 콜드 스타트가 여전히 거슬리면, $20)**: **Vercel Pro** — 콜드 스타트의 유일한 직접 해법이며, 부수로 Hobby 비상업 약관 리스크(광고·모금 금지)도 해소된다. 같은 돈이면 Supabase Pro(②)보다 Pro(③)가 체감 개선이 훨씬 크다
3. **3단계 (오픈 후 실회원 트래픽 보고, +$25)**: Supabase Pro — DB 정지 리스크 제거 + 자동 백업이 "운영 안심" 가치. 성능 목적으로는 서두를 필요 없음
4. **플랫폼 이전(⑤)은 비권고**: 서울 리전을 가진 대안이 사실상 없어(CF 제외) 속도 개선 목적과 모순이고, CF는 운영 복잡도가 원칙과 상충

> 현 조합(Vercel icn1 + Supabase Seoul)은 "양쪽 다 서울 + 완전 관리형"을 만족하는 거의 유일한 무료 조합이다. 문제는 조합이 아니라 ① 우리가 아직 안 한 최적화 ② Hobby의 의도된 제약 — 각각 $0과 $20으로 해결된다.

## 출처

- Vercel: [Fluid Compute](https://vercel.com/docs/fluid-compute) · [Scale to One](https://vercel.com/blog/scale-to-one-how-fluid-solves-cold-starts) · [Bytecode caching](https://vercel.com/blog/introducing-bytecode-caching-for-vercel-functions) · [Functions pricing](https://vercel.com/docs/functions/usage-and-pricing)
- Supabase: [Pricing](https://supabase.com/pricing) · [Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk)
- 대안: [Neon regions](https://neon.com/docs/introduction/regions) · [Fly.io regions](https://fly.io/docs/reference/regions/)·[pricing](https://fly.io/docs/about/pricing/) · [OpenNext Cloudflare](https://opennext.js.org/cloudflare) · [Railway regions](https://docs.railway.com/deployments/regions) · [Render regions](https://render.com/docs/regions) · [PlanetScale Postgres pricing](https://planetscale.com/docs/postgres/pricing)
- 실측: 2026-06-12 prod curl TTFB (이 문서 §1)
