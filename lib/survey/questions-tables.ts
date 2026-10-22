// 질의서 Q1·Q4 표 — 원본 표를 스크립트로 옮긴 스냅샷 값(손으로 고치지 말고, 바꿀 땐 원본과 대조).
// 원본: gforest-analysis/docs/2026-09/99_배포용/99_이해관계자_의견요청서_배포용.md (Q1 표 31–65행, Q4 표 96–108행).
// DB `boards` 테이블을 조회하지 않는다 — 글 수·최근 글은 2026-10-08 기준 고정 문자열, 회원 수는 2026-06-26 기준.
// 행 key(b01..b35)는 원본 행 순서의 리터럴이다. 저장된 응답이 이 key 로 읽히므로 바꾸지 않는다.
import type { BoardRow } from "./types";

export const BOARDS_Q1: readonly BoardRow[] = [
  { key: "b01", name: "교류게시판", who: "누구나", posts: "6,661", recent: "2026.10.05", access: "public" },
  { key: "b02", name: "학부모게시판", who: "로그인 후", posts: "5,696", recent: "2026.09.30", access: "login" },
  { key: "b03", name: "품의서", who: "로그인 후", posts: "4,363", recent: "2026.09.29", access: "login" },
  { key: "b04", name: "학생게시판", who: "운영위원·교사·강사·학생만", posts: "3,014", recent: "2025.01.03", access: "restricted" },
  { key: "b05", name: "알려드립니다·공지", who: "누구나", posts: "2,998", recent: "2026.10.08", access: "public" },
  { key: "b06", name: "운영위원회", who: "운영위원만", posts: "2,597", recent: "2026.03.26", access: "restricted" },
  { key: "b07", name: "교사회", who: "교사만", posts: "2,474", recent: "2026.07.18", access: "restricted" },
  { key: "b08", name: "회의록-교사회", who: "교사만", posts: "2,234", recent: "2026.10.06", note: "아래 \"회의록 학부모회·학년\"과는 다른 게시판", access: "restricted" },
  { key: "b09", name: "너른방", who: "교사·강사만", posts: "2,167", recent: "2026.08.15", access: "restricted" },
  { key: "b10", name: "회의록 학부모회·학년", who: "로그인 후", posts: "2,033", recent: "2026.10.01", access: "login" },
  { key: "b11", name: "학교이야기", who: "누구나", posts: "1,164", recent: "2026.09.18", access: "public" },
  { key: "b12", name: "동호회", who: "로그인 후", posts: "796", recent: "2026.08.19", access: "login" },
  { key: "b13", name: "학부모자료실", who: "로그인 후", posts: "760", recent: "2026.10.08", access: "login" },
  { key: "b14", name: "정보｜강좌｜좋은글", who: "누구나", posts: "730", recent: "2026.09.15", access: "public" },
  { key: "b15", name: "벼룩시장｜부동산", who: "로그인 후", posts: "529", recent: "2026.07.18", access: "login" },
  { key: "b16", name: "자유게시판", who: "로그인 후", posts: "441", recent: "2026.09.21", note: "교류게시판과 성격이 겹칠 수 있음", access: "login" },
  { key: "b17", name: "운영위에게", who: "운영위원만", posts: "318", recent: "2025.12.23", access: "restricted" },
  { key: "b18", name: "안건방", who: "교사만", posts: "238", recent: "2026.10.06", access: "restricted" },
  { key: "b19", name: "교사회자료실", who: "교사·강사만", posts: "150", recent: "2025.09.12", access: "restricted" },
  { key: "b20", name: "도서관", who: "로그인 후", posts: "135", recent: "2019.10.15", access: "login" },
  { key: "b21", name: "방과후 돌봄", who: "로그인 후", posts: "104", recent: "2024.05.06", access: "login" },
  { key: "b22", name: "푸른숲오케스트라", who: "로그인 후", posts: "81", recent: "2026.03.25", access: "login" },
  { key: "b23", name: "신편입학 Q&A", who: "누구나", posts: "62", recent: "2025.12.09", access: "public" },
  { key: "b24", name: "방과후 악기", who: "로그인 후", posts: "51", recent: "2026.08.11", access: "login" },
  { key: "b25", name: "홈피제안/오류", who: "로그인 후", posts: "41", recent: "2023.04.22", access: "login" },
  { key: "b26", name: "학부모 교육자료모음", who: "로그인 후", posts: "38", recent: "2026.09.04", access: "login" },
  { key: "b27", name: "열음자리 뚝딱이", who: "로그인 후", posts: "33", recent: "2021.06.29", note: "신축 관련 기록", access: "login" },
  { key: "b28", name: "중학년 방과후", who: "로그인 후", posts: "31", recent: "2025.08.19", access: "login" },
  { key: "b29", name: "학부모회", who: "로그인 후", posts: "30", recent: "2019.02.26", access: "login" },
  { key: "b30", name: "발도르프관련사이트", who: "누구나(추정)", posts: "약 27", recent: "—", note: "외부 링크 모음. 익명 접속은 실측하지 않음", access: "public" },
  { key: "b31", name: "진로탐색자료실", who: "로그인 후", posts: "26", recent: "2025.12.24", access: "login" },
  { key: "b32", name: "푸른숲사진첩", who: "로그인 후", posts: "약 20", recent: "2015.05.29", access: "login" },
  { key: "b33", name: "교육자료실", who: "누구나", posts: "13", recent: "2024.05.11", access: "public" },
  { key: "b34", name: "살림살이·재정공개", who: "누구나", posts: "8", recent: "2026.03.18", access: "public" },
  { key: "b35", name: "학부모회에게", who: "로그인 후", posts: "7", recent: "2024.03.07", note: "관리자·학부모회만 볼 수 있는 것으로 추정(확인 필요)", access: "restricted" },
];

export const MEMBER_GROUPS_Q4: readonly { label: string; value: string }[] = [
  { label: "기본", value: "2,825" },
  { label: "OB(졸업생 등)", value: "630" },
  { label: "학부모", value: "206" },
  { label: "교사", value: "25" },
  { label: "강사", value: "22" },
  { label: "운영위원", value: "12" },
  { label: "학생", value: "10" },
  { label: "행정실", value: "3" },
  { label: "학부모회", value: "2" },
  { label: "관리자", value: "2" },
  { label: "프로젝트팀", value: "1" },
  { label: "방과후교사/유치원", value: "1" },
  { label: "푸른숲학교", value: "0" },
];
