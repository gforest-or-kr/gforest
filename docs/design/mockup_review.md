# 홈페이지 디자인 시안 검토 (학부모 개발자 제공)

> 출처: https://download.clinkers.io/gforest/docs/mockup/
> 성격: "AI 주도 디자인/개발 데모 목업" (2026-06 제작, 학부모 개발자 제공)
> 기록일: 2026-06-19 · 관련: [`screen_design.md`](screen_design.md) · [`rendering.md`](rendering.md)

학부모 개발자분이 푸른숲 홈페이지 리디자인 시안 5종을 남겨주셨다. 모두 **흰 배경 + forest green / teal / earth-tone 액센트**라는 공통 팔레트를 쓴다. 본 문서는 시안 목록을 기록하고, 그중 **시안 A(Modern Minimal)**가 현재 우리 Next.js 구현에 적용 가능한지를 검토한다.

## 1. 시안 목록

| 시안 | 이름 | 경로 | 특징 |
|------|------|------|------|
| **A** | Modern Minimal | `design-a-modern.html` | 대형 사진 + teal 절제 액센트, sans-serif, 클린 그리드. "머리·가슴·손" 강조 |
| **B** | Warm Waldorf Tone | `design-b-waldorf.html` | serif 폰트, 유기적 곡선·잎사귀 모티브, earth-tone, 카드형 SNS 피드 |
| **C** | Denver Waldorf Reference | `denver/index.html` | 실제 Denver 발도르프 레이아웃 차용. 정보 밀도·내비게이션 중심 |
| **D** | Toronto Waldorf Reference | `toronto/index.html` | 자동 회전 캐러셀·활동 사진 강조, clay tone |
| **E** | Sophia Mundi Reference | `sophiamundi/index.html` | 텍스트 중심·여백 넉넉, teal 강조, 절제된 밴드 구조 |

A·B는 오리지널 디자인, C·D·E는 해외 발도르프 학교 레이아웃을 푸른숲 아이덴티티 컬러로 각색한 레퍼런스 구현이다.

## 2. 시안 A 상세

### 디자인 토큰 (목업 CSS)
```
--forest:#1F5C46;  --forest-deep:#163D2F;
--teal:#2C8C7C;    --teal-soft:#4FB3A0;
--bg:#ffffff;      --bg-soft:#F4F7F4;   --line:#E4EAE6;
--ink:#1A2421;     --muted:#5B6B63;
--maxw:1180px;     --radius:18px;
--shadow:0 18px 50px -24px rgba(22,61,47,.45);
--font:"Pretendard Variable",Pretendard,...,sans-serif;
```

### 페이지 구조 (위→아래 단일 스크롤)
- **헤더**: 고정 내비 + 로고. 메뉴 = 학교소개 / 교육과정 / 학교소식 / 학사일정 / 입학안내 / 오시는길. 모바일 햄버거
- **히어로**: 풀폭 사진 + 카피("자연 속에서, 함께 배우고, 스스로 자라는") + hero-chips(개교 22년 등)
- **about** (#about): 7년 주기 발달관 — 손·가슴·머리 3단계
- **courses** (#courses): grid-cards — 담임과정 / 상급과정 / 절기와 공동체 행사 / 예술·노작·음악
- **band**: 학부모 공동체(살림살이 공개 총회 등) 강조 밴드
- **news** (#news): "알려드립니다" 타임스탬프 공지 카드
- **schedule** (#schedule): "다가오는 일정" 날짜형 리스트
- **kindergarten** (#kindergarten): 병설어린이집·유아과정
- **admit** (#admit): 수시 편입학 안내 + CTA(온라인 입학설명회 신청)
- **media-strip** (#gallery): YouTube/Instagram 카드 임베드
- 스크롤 진입 시 `.reveal` 애니메이션

성격상 **마케팅/브로슈어형 랜딩**이다(정적 소개 콘텐츠 비중 큼). 현재 우리 홈은 **회원 개인화 포털 대시보드**(공지·일정·게시판 위젯 + 회원 전용 위젯)라는 점이 가장 큰 차이.

## 3. 적용 가능성 검토 (vs 현행 구현)

현행: Tailwind v4, `app/page.tsx`(312줄, `force-dynamic`), forest 팔레트(`globals.css`), 시스템 폰트, 카드형(`rounded-3xl`) 위젯, `HeroSlider` 보유.

| 항목 | 호환성 | 비고 |
|------|--------|------|
| **컬러 팔레트** | 🟢 높음 | 같은 그린 계열. 목업 forest `#1F5C46`·teal `#2C8C7C`는 현행 forest-700 `#1d6845`와 미세 차이뿐. **teal 액센트 토큰만 신규 추가**하면 됨 |
| **레이아웃/카드/그리드** | 🟢 높음 | 전부 Tailwind로 재현 가능. `rounded-3xl` 카드·그리드 패턴 이미 사용 중 |
| **히어로·캐러셀** | 🟢 높음 | `HeroSlider`·`slides` 테이블 이미 존재. hero-chips는 사소 |
| **reveal 스크롤 애니메이션** | 🟢 높음 | 소량 클라 JS(IntersectionObserver) |
| **media-strip(YouTube/IG)** | 🟢 높음 | 외부 임베드 → egress 비용 없음. 이미지 한도(#8) 무관 |
| **폰트 (Pretendard Variable)** | 🔴 **충돌** | 기술원칙 #25/#8 = 시스템 폰트(웹폰트 전송 0). Pretendard 채택 시 self-host+subset 필요(egress 5GB/월 한도 압박). **권장: 시스템 폰트 유지 or 서브셋 self-host 신중 검토** |
| **정보구조(IA) 전환** | 🟡 결정 필요 | 브로슈어형 ↔ 현행 포털 대시보드. "정적 소개 섹션 + 기존 공지/일정/회원 위젯" **하이브리드** 권장 |
| **렌더링(ISR/동적)** | 🟡 주의 | 시안 A 섹션 대부분 정적 → ISR 적합. 단 현행 홈은 회원 위젯 때문에 `force-dynamic`. **정적 셸 + 회원 개인화 클라 아일랜드**(원칙 #9, rendering.md)로 유지해야 ISR 이점 확보 |

### 결론
시안 A의 **비주얼/레이아웃은 적용 난이도 낮음** — 사실상 CSS·레이아웃 리스킨이며 팔레트·컴포넌트가 이미 정렬돼 있다. 실제 의사결정 포인트는 디자인이 아니라 다음 3가지:

1. **폰트**: Pretendard(웹폰트) 도입 여부 — 무료 티어 egress·성능 원칙과 충돌. 시스템 폰트 유지가 안전.
2. **정보구조**: 홈을 브로슈어형으로 전환할지, 현행 회원 포털 위젯을 유지/병합할지. 하이브리드(소개 섹션 + 위젯) 권장.
3. **렌더링 경계**: 정적 셸 + 회원 개인화 클라 아일랜드 패턴을 지켜 ISR 깨지지 않게 (rendering.md의 `DYNAMIC_SERVER_USAGE` 함정).

→ **"적용 가능한가"의 답은 예** (디자인 자체는 호환). 남은 건 위 3개 정책 결정.

## 4. 프로토타입 (GFM-63)

검토 결론을 실물로 확인하기 위해 시안 A 프로토타입을 **별도 진입점**으로 구현했다 — 운영 사이트는 그대로 두고 `/preview/design-a`에서만 보인다.

- **구조**: 라우트 그룹으로 셸 이원화 — 글로벌 `Header`/`Footer`를 루트 레이아웃에서 `app/(site)/layout.tsx`로 내리고, 프로토타입은 `app/(proto)/`에 자체 셸. 라우트 그룹은 URL 불변이라 기존 경로·동작 100% 보존.
- **폰트**: 프리뷰 전용 Pretendard(CDN). 운영 본사이트는 시스템 폰트 유지(#25/#8).
- **콘텐츠**: 정적 샘플(목업과 동일 더미), 사진은 forest→teal 그라데이션 플레이스홀더. 쿠키·DB 미호출 → 정적 프리렌더(렌더링 함정 #9 회피), robots noindex + `/preview` disallow.
- **검증**: `next build` 통과, `/preview/design-a`=Static, 기존 라우트 렌더링 모드 불변. 모바일 WebKit(WKWebView) 시각 확인 완료.
