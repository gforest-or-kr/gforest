// 이해관계자 웹 질의서 문항 정의 — 화면·검증기·집계의 단일 진실(SVY-02).
// 원본: gforest-analysis/docs/2026-09/99_배포용/99_이해관계자_의견요청서_배포용.md (읽기 전용, 수정 금지).
// 문구 변경은 이 파일만 고친다(PR). 키(질문 id·item key·보기 key)는 리터럴로 적고,
// 의미가 바뀌면 새 키를 쓴다 — 이미 저장된 응답이 다른 뜻으로 읽히지 않게.
import type { Question, RespondentRole, Section } from "./types";

export const SECTIONS: readonly Section[] = [
  { no: 0, title: "응답자 구분" },
  { no: 1, title: "게시판 정리" },
  { no: 2, title: "회원 그룹과 열람 권한" },
  { no: 3, title: "자료 이관과 회원 계정" },
  { no: 4, title: "입학 안내와 외부 홍보" },
  { no: 5, title: "공개 정보" },
  { no: 6, title: "일정과 공유" },
  { no: 7, title: "디자인과 브랜드" },
  { no: 8, title: "비용" },
  { no: 9, title: "홈페이지의 역할과 최근 변화" },
  { no: 10, title: "자유 의견" },
];

// 0절 응답자 구분 — 순서 고정(원본 파일의 순서와 다름, 확정 결정).
export const RESPONDENT_ROLES: readonly RespondentRole[] = [
  { key: "parent", label: "학부모" },
  { key: "teacher_council", label: "교사회" },
  { key: "admin_office", label: "행정실" },
  { key: "steering_committee", label: "운영위원회" },
  { key: "admissions_pr", label: "홍보전형위원회" },
  { key: "other", label: "기타(학부모회 산하 소위원회 등)", other: true },
];

export const QUESTIONS: readonly Question[] = [
  {
    id: "q2",
    no: 2,
    section: 1,
    title: "\"방과후활동\" 소개 페이지에 비용·일정·신청 방법을 공개하는 방안, 어떻게 생각하시나요?",
    lead: [
      "지금은 비용·일정·신청 방법 안내가 없어 전화 문의로만 확인할 수 있습니다. 누구나 보는 소개 페이지에 이 정보까지 실어 두면 문의 응대 부담도 줄고, 찾아보시는 분들도 더 편하실 것 같습니다.",
    ],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "동의(전체 공개)" },
          { key: "o2", label: "일부만 공개", blank: { label: "공개 범위:" } },
          { key: "o3", label: "반대(비공개 유지)" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
];
