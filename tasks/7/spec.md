# spec: 모바일에서 가로 스크롤 발생 — 닫힌 오프캔버스 메뉴가 화면 밖에서 클리핑되지 않음 (#7)

## 요약
모바일 뷰포트(390px)에서 페이지 전체에 약 284px의 가로 스크롤이 생긴다. 원인은
`components/header-nav.tsx`의 모바일 드로어다. 이 드로어는 `fixed inset-0`로 뷰포트
전폭(390px)을 차지하며, 닫힘 상태에서 `translate-x-full`로 화면 오른쪽 밖으로 밀어낸다.
그러나 `transform: translate`는 요소를 **레이아웃에서 제거하지 않으므로** 문서의 가로
스크롤 영역(scrollWidth)에 그대로 기여한다. 결과적으로 문서 폭이 뷰포트의 약 2배(674px)가
된다. 현재 `app/globals.css`의 `html`/`body`에는 가로 오버플로를 제한하는 규칙이 없다.

수정 방침: 루트 요소(`html`)에 `overflow-x: clip`을 적용해 초기 컨테이닝 블록(ICB)을
벗어난 `fixed` 드로어를 뷰포트 밖에서 클리핑한다. `overflow-x: clip`은 `hidden`과 달리
스크롤 컨테이너를 만들지 않아 `sticky` 헤더의 동작을 깨지 않는다. 이는 모든 페이지에
일괄 적용되는 가장 작고 견고한 전역 수정이다.

## 구현 계획

### `app/globals.css` (수정)
- `body { ... }` 규칙 인근(20–25행)에, 루트 요소의 가로 오버플로를 클리핑하는 규칙을
  추가한다. `html`을 대상으로 한다 — `fixed` 요소의 컨테이닝 블록은 뷰포트/ICB이고,
  루트 요소의 오버플로가 뷰포트로 전파되어 화면 밖 `fixed` 드로어를 클리핑한다.

  ```css
  /* 닫힌 오프캔버스 모바일 메뉴(fixed + translate-x-full)가
     화면 밖에서 문서 가로 스크롤을 만들지 않도록 클리핑 (#7).
     overflow-x: hidden 대신 clip — 스크롤 컨테이너를 만들지 않아 sticky 헤더를 보존한다. */
  html {
    overflow-x: clip;
  }
  ```

- 세로 스크롤은 영향받지 않아야 한다(`overflow-y`는 건드리지 않음). `overflow-x`만 지정한다.

### 비고 — 대안(채택하지 않음, 참고용)
- 드로어 요소 자체에 닫힘 시 `invisible`(visibility:hidden)을 추가하는 방법은 부적합하다.
  `visibility: hidden` 요소도 레이아웃 공간을 차지해 scrollWidth에 계속 기여하므로 가로
  스크롤이 해소되지 않는다.
- `display:none`(예: `hidden` 클래스) 토글은 scrollWidth는 해소하나 `transition-transform`
  슬라이드 애니메이션을 깨뜨린다. 따라서 전역 `overflow-x: clip`을 채택한다.

## Acceptance Criteria
- [ ] 390px 뷰포트로 메인(`/`) 접속 시 `document.documentElement.scrollWidth === document.documentElement.clientWidth` (가로 스크롤 없음).
- [ ] 좌우 스와이프로 화면 오른쪽 밖의 닫힌 메뉴 영역이 드러나지 않는다.
- [ ] 햄버거 버튼으로 모바일 드로어를 열면 정상적으로 전체 화면에 표시되고, ✕ 버튼으로 닫힌다 (열기/닫기 동작 보존).
- [ ] 드로어 열림/닫힘 시 좌우 슬라이드 전환 애니메이션(`transition-transform`)이 유지된다.
- [ ] `sticky` 헤더가 스크롤 시 상단에 계속 고정된다 (overflow-x:clip이 sticky를 깨지 않음).
- [ ] 세로 스크롤은 정상 동작하며, 본문이 잘리지 않는다.
- [ ] `app/globals.css` 외 다른 파일은 수정하지 않는다.

## 범위 제외
- 닫힌 드로어가 화면 밖에 있어도 포커스/탭 순서에 남는 접근성(aria-hidden, inert) 문제는
  이번 이슈(가로 스크롤) 범위가 아니다.
- 데스크탑 GNB 드롭다운, 헤더 레이아웃, 메뉴 데이터(`lib/menu`) 변경은 하지 않는다.
- 드로어를 `fixed inset-0` 풀스크린 구조에서 다른 패턴(슬라이드 패널 등)으로 재설계하지 않는다.
