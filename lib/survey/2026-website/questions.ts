// 이해관계자 웹 질의서 문항 정의 — 화면·검증기·집계의 단일 진실(SVY-02).
// 원본: gforest-analysis/docs/2026-09/99_배포용/99_이해관계자_의견요청서_배포용.md (읽기 전용, 수정 금지).
// 문구 변경은 이 파일과 questions-part*.ts·questions-tables.ts 만 고친다(PR). 키(질문 id·item key·보기 key)는 리터럴로 적고,
// 의미가 바뀌면 새 키를 쓴다 — 이미 저장된 응답이 다른 뜻으로 읽히지 않게.
import { QUESTIONS_PART1 } from "./questions-part1";
import { QUESTIONS_PART2 } from "./questions-part2";
import type { Question, RespondentRole, Section } from "../types";

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

// 1~4절(Q1–Q14) + 5~10절(Q15–Q27, 자유 의견 free). 순서 = 화면·CSV 열 순서.
export const QUESTIONS: readonly Question[] = [...QUESTIONS_PART1, ...QUESTIONS_PART2];
