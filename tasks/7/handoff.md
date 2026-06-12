# handoff: #7

## 변경 파일
- `app/globals.css`: 루트 요소(`html`)에 `overflow-x: clip` 규칙을 추가. 닫힌 모바일
  드로어(`fixed inset-0` + `translate-x-full`로 화면 오른쪽 밖에 위치)가 문서 가로
  스크롤 영역(scrollWidth)에 기여하던 것을 뷰포트 밖에서 클리핑한다. `body` 규칙
  바로 위에 배치.

## 핵심 결정
- spec 그대로 구현. `overflow-x: hidden`이 아니라 `clip`을 사용 — `hidden`은 스크롤
  컨테이너를 생성해 `sticky` 헤더 동작을 깨뜨릴 수 있지만 `clip`은 그렇지 않다.
- `overflow-y`는 손대지 않아 세로 스크롤은 그대로 유지된다.
- `html`을 대상으로 한 이유: `fixed` 요소의 컨테이닝 블록은 ICB(뷰포트)이며, 루트
  요소의 가로 오버플로 처리가 뷰포트로 전파되어 화면 밖 `fixed` 드로어를 클리핑한다.
- spec과 달라진 점 없음. acceptance criteria #7(globals.css 외 수정 금지)에 따라
  `components/header-nav.tsx` 등 다른 파일은 일절 건드리지 않았다.

## 검증 방법
- `npm run dev` 후 브라우저를 390px 폭(모바일)으로 설정.
- 콘솔에서:
  `document.documentElement.scrollWidth === document.documentElement.clientWidth` → `true` 확인 (가로 스크롤 없음).
- 좌우 스와이프 시 화면 오른쪽 밖의 닫힌 메뉴 영역이 드러나지 않는지 확인.
- 햄버거 버튼으로 드로어를 열어 전체 화면 표시 + 좌우 슬라이드 애니메이션 동작 확인,
  ✕ 버튼으로 닫기 + 슬라이드아웃 애니메이션 확인.
- 페이지를 아래로 스크롤해 `sticky` 헤더가 상단에 계속 고정되는지, 세로 스크롤로
  본문이 잘리지 않는지 확인.

## 리뷰 포인트
- `overflow-x: clip` 브라우저 호환성: 모던 브라우저(Chrome 90+, Safari 16+, Firefox 81+)
  지원. 학교 사용자층 기준 충분하다고 판단했으나, 더 넓은 지원이 필요하다면 `hidden`
  fallback 논의 가능(단 sticky 헤더 영향 검토 필요).
- 드로어가 열린 상태(`translate-x-0`)에서도 `clip`이 드로어 내부 콘텐츠를 의도치 않게
  자르지 않는지 — 드로어는 뷰포트 폭에 딱 맞으므로 문제없을 것으로 보지만 실기기 확인 권장.
