"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode, type Ref } from "react";
import { QUESTIONS, RESPONDENT_ROLES, SECTIONS } from "@/lib/survey/questions";
import { ROLE_OTHER_MAX } from "@/lib/survey/validate";
import type { ItemValue, QuestionValue } from "@/lib/survey/types";
import { submitSurvey, type SubmitResult } from "../actions";
import { HowBox, PaperHead } from "./papers";
import { QuestionBlock } from "./question-block";
import { preventEnter } from "./text-fields";

// 질의서 작성 화면(11쪽 = 0~10절). 입력 상태는 전부 이 컴포넌트 최상단에 두고 쪽은 props 로만 그린다
// (쪽을 넘겨 언마운트돼도 값이 남는다). form 요소 없음 — 모든 버튼 type="button", Enter 로 이동·제출되지 않는다.

const NOTICE_NO_ROLES = "※ 응답자 구분을 하나 이상 선택해 주세요.";
const NOTICE_FAILED = "제출하지 못했어요. 입력하신 내용은 그대로 남아 있어요. 잠시 뒤 다시 눌러 주세요.";
const LAST_PAGE = SECTIONS.length - 1;

type Notice = "none" | "no_roles" | "failed";
type Answers = Record<string, QuestionValue>;

// 항목 값 하나를 바꾼 새 answers. undefined = 항목 키 삭제, 항목이 모두 비면 질문 자체를 뺀다(불변 갱신)
function withItem(answers: Answers, qid: string, itemKey: string, v: ItemValue | undefined): Answers {
  const rest = Object.fromEntries(Object.entries(answers[qid] ?? {}).filter(([k]) => k !== itemKey));
  const nextQ: QuestionValue = v === undefined ? rest : { ...rest, [itemKey]: v };
  const others = Object.fromEntries(Object.entries(answers).filter(([k]) => k !== qid));
  return Object.keys(nextQ).length === 0 ? others : { ...others, [qid]: nextQ };
}

interface SurveyFormProps {
  initialRaw: string;
  onDone: () => void;
  onClosed: (closedAtLabel: string) => void;
}

export function SurveyForm({ onDone, onClosed }: SurveyFormProps) {
  const [page, setPage] = useState(0);
  const [roles, setRoles] = useState<readonly string[]>([]);
  const [roleOther, setRoleOther] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [notice, setNotice] = useState<Notice>("none");
  const [pending, startTransition] = useTransition();
  // 제출 id 는 클릭 핸들러에서 한 번 만들고 재시도 때 그대로 다시 보낸다(서버가 중복 저장을 막는다)
  const submissionId = useRef<string | null>(null);
  const firstRole = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const shownPage = useRef(page);

  // 쪽이 바뀐 뒤에만: 맨 위로 스크롤 + 새 절 제목에 포커스(첫 마운트·StrictMode 재실행에서는 움직이지 않음)
  useEffect(() => {
    if (shownPage.current === page) return;
    shownPage.current = page;
    window.scrollTo(0, 0);
    heading.current?.focus();
  }, [page]);

  function toggleRole(key: string, checked: boolean, isOther: boolean) {
    // 정의 순서를 유지한 새 배열(불변 갱신)
    setRoles((prev) => RESPONDENT_ROLES.filter((r) => (r.key === key ? checked : prev.includes(r.key))).map((r) => r.key));
    if (isOther && !checked) setRoleOther("");
    if (checked && notice === "no_roles") setNotice("none");
  }

  function setItem(qid: string, itemKey: string, v: ItemValue | undefined) {
    setAnswers((prev) => withItem(prev, qid, itemKey, v));
  }

  function goTo(next: number) {
    if (page === 0 && next > 0 && roles.length === 0) {
      setNotice("no_roles");
      firstRole.current?.focus();
      return;
    }
    setNotice("none");
    setPage(next);
  }

  function submit() {
    if (roles.length === 0) {
      goTo(0);
      setNotice("no_roles");
      return;
    }
    submissionId.current ??= crypto.randomUUID();
    const payload = { submissionId: submissionId.current, roles: [...roles], roleOther, answers };
    setNotice("none");
    startTransition(async () => {
      // 네트워크 끊김 등으로 액션 호출 자체가 실패해도 오류 화면이 아니라 같은 쪽 안내로 끝낸다(입력 유지)
      const r = await submitSurvey(payload).catch((): SubmitResult => ({ ok: false, reason: "error" }));
      if (r.ok) onDone();
      // 작성 도중 마감: 서버가 거절 → 마감 화면 + "제출되지 않았어요"
      else if (r.reason === "closed") onClosed(r.closedAtLabel);
      else setNotice("failed");
    });
  }

  const section = SECTIONS[page];
  return (
    <div className="svy-paper">
      <div className="svy-bar">
        <span>
          제 <b>{page + 1}</b>쪽 / {SECTIONS.length}쪽 · {section.title}
        </span>
        <span className="svy-saved" aria-live="off">
          자동 저장 대기 중
        </span>
      </div>
      {page === 0 && (
        <>
          <PaperHead />
          <HowBox />
        </>
      )}
      <h2 className="svy-sec" tabIndex={-1} ref={heading}>
        {section.no}. {section.title}
      </h2>
      {page === 0 ? (
        <RolesBox
          roles={roles}
          roleOther={roleOther}
          disabled={pending}
          firstRef={firstRole}
          showAlert={notice === "no_roles"}
          onToggle={toggleRole}
          onOther={setRoleOther}
        />
      ) : (
        QUESTIONS.filter((q) => q.section === section.no).map((q) => (
          <QuestionBlock
            key={q.id}
            question={q}
            value={answers[q.id]}
            disabled={pending}
            onChange={(itemKey, v) => setItem(q.id, itemKey, v)}
          />
        ))
      )}
      {page === LAST_PAGE && (
        <p className="svy-sm svy-center">빈 문항이 있어도 제출할 수 있어요. 제출한 뒤에는 이 화면에서 고칠 수 없습니다.</p>
      )}
      {notice === "failed" && (
        <div className="svy-notice" role="alert">
          <b>{NOTICE_FAILED}</b>
        </div>
      )}
      <div className="svy-nav">
        <button type="button" className="svy-btn" disabled={page === 0 || pending} onClick={() => goTo(page - 1)}>
          이전 쪽
        </button>
        {page === LAST_PAGE ? (
          <button type="button" className="svy-btn svy-btn--primary" disabled={pending} onClick={submit}>
            {pending ? "제출하는 중…" : "제출하기"}
          </button>
        ) : (
          <button type="button" className="svy-btn svy-btn--primary" disabled={pending} onClick={() => goTo(page + 1)}>
            다음 쪽
          </button>
        )}
      </div>
    </div>
  );
}

interface RolesBoxProps {
  roles: readonly string[];
  roleOther: string;
  disabled: boolean;
  firstRef: Ref<HTMLInputElement>;
  showAlert: boolean;
  onToggle: (key: string, checked: boolean, isOther: boolean) => void;
  onOther: (text: string) => void;
}

// 0절 응답자 구분(필수, 다중). 기타를 고르면 직접 입력칸이 펼쳐진다.
function RolesBox({ roles, roleOther, disabled, firstRef, showAlert, onToggle, onOther }: RolesBoxProps) {
  const headId = useId();
  return (
    <>
      {showAlert && (
        <div className="svy-notice" role="alert">
          <b>{NOTICE_NO_ROLES}</b>
        </div>
      )}
      <div className="svy-box">
        <div className="svy-box-h" id={headId}>
          나는 다음 중 무엇에 해당하나요? (해당하는 것 모두 · 필수)
        </div>
        <div className="svy-box-b" role="group" aria-labelledby={headId}>
          {RESPONDENT_ROLES.map((r, i) => (
            <RoleOption
              key={r.key}
              label={r.label}
              checked={roles.includes(r.key)}
              disabled={disabled}
              inputRef={i === 0 ? firstRef : undefined}
              onChange={(checked) => onToggle(r.key, checked, r.other === true)}
              other={
                r.other === true ? (
                  <div className="svy-ans">
                    <input
                      className="svy-line"
                      type="text"
                      aria-label="기타 응답자 구분 직접 입력"
                      placeholder="직접 입력"
                      maxLength={ROLE_OTHER_MAX}
                      value={roleOther}
                      disabled={disabled}
                      onKeyDown={preventEnter}
                      onChange={(e) => onOther(e.target.value)}
                    />
                  </div>
                ) : null
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}

interface RoleOptionProps {
  label: string;
  checked: boolean;
  disabled: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (checked: boolean) => void;
  other: ReactNode;
}

function RoleOption({ label, checked, disabled, inputRef, onChange, other }: RoleOptionProps) {
  return (
    <>
      <label className="svy-opt svy-opt--check">
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="svy-no-cell">
          <span className="svy-no" aria-hidden="true" />
        </span>
        <span className="svy-opt-t">{label}</span>
      </label>
      {other}
    </>
  );
}
