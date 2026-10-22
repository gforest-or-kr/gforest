"use client";

import { useId, useRef, useState, useTransition } from "react";
import { RESPONDENT_ROLES, SECTIONS } from "@/lib/survey/questions";
import { submitSurvey, type SubmitResult } from "../actions";
import { ClosedPaper, DonePaper, HowBox, PaperHead, RevisitPaper } from "./papers";

// 질의서 응답 화면(클라이언트). 첫 화면은 서버가 정해 initialView 로 넘긴다 — 초깃값으로만 쓰고
// 이후 prop 으로 화면을 다시 파생하지 않는다(서버 액션이 쿠키를 심으면 페이지가 다시 렌더되기 때문).
// form 요소를 쓰지 않는다: 모든 버튼은 type="button", Enter 로 제출되지 않는다.

type View = "form" | "done" | "revisit" | "closed";

const NOTICE_NO_ROLES = "※ 응답자 구분을 하나 이상 선택해 주세요.";
const NOTICE_FAILED = "제출하지 못했어요. 입력하신 내용은 그대로 남아 있어요. 잠시 뒤 다시 눌러 주세요.";

type Notice = "none" | "no_roles" | "failed";

interface SurveyFormProps {
  onDone: () => void;
  onClosed: (closedAtLabel: string) => void;
}

function SurveyForm({ onDone, onClosed }: SurveyFormProps) {
  const [roles, setRoles] = useState<readonly string[]>([]);
  const [roleOther, setRoleOther] = useState("");
  const [notice, setNotice] = useState<Notice>("none");
  const [pending, startTransition] = useTransition();
  // 제출 id 는 클릭 핸들러에서 한 번 만들고 재시도 때 그대로 다시 보낸다(서버가 중복 저장을 막는다)
  const submissionId = useRef<string | null>(null);
  const firstRole = useRef<HTMLInputElement>(null);
  const boxHeadId = useId();

  function toggleRole(key: string, checked: boolean, isOther: boolean) {
    // 정의 순서를 유지한 새 배열(불변 갱신)
    setRoles((prev) => RESPONDENT_ROLES.filter((r) => (r.key === key ? checked : prev.includes(r.key))).map((r) => r.key));
    if (isOther && !checked) setRoleOther("");
  }

  function submit() {
    if (roles.length === 0) {
      setNotice("no_roles");
      firstRole.current?.focus();
      return;
    }
    submissionId.current ??= crypto.randomUUID();
    const payload = { submissionId: submissionId.current, roles: [...roles], roleOther, answers: {} };
    setNotice("none");
    startTransition(async () => {
      // 네트워크 끊김 등으로 액션 호출 자체가 실패해도 오류 화면이 아니라 같은 쪽 안내로 끝낸다(입력 유지)
      const r = await submitSurvey(payload).catch((): SubmitResult => ({ ok: false, reason: "error" }));
      if (r.ok) onDone();
      // 작성 도중 마감: 서버가 거절 → 마감 화면 + "제출되지 않았어요". 임시 저장본(02-04)은 건드리지 않는다.
      else if (r.reason === "closed") onClosed(r.closedAtLabel);
      else setNotice("failed");
    });
  }

  return (
    <div className="svy-paper">
      <div className="svy-bar">
        <span>
          제 <b>1</b>쪽 / {SECTIONS.length}쪽 · {SECTIONS[0].title}
        </span>
      </div>
      <PaperHead />
      <HowBox />
      <h2 className="svy-sec">0. {SECTIONS[0].title}</h2>
      {notice === "no_roles" && (
        <div className="svy-notice" role="alert">
          <b>{NOTICE_NO_ROLES}</b>
        </div>
      )}
      <div className="svy-box">
        <div className="svy-box-h" id={boxHeadId}>
          나는 다음 중 무엇에 해당하나요? (해당하는 것 모두 · 필수)
        </div>
        <div className="svy-box-b" role="group" aria-labelledby={boxHeadId}>
          {RESPONDENT_ROLES.map((r, i) => (
            <RoleOption
              key={r.key}
              label={r.label}
              checked={roles.includes(r.key)}
              disabled={pending}
              inputRef={i === 0 ? firstRole : undefined}
              onChange={(checked) => toggleRole(r.key, checked, r.other === true)}
              other={
                r.other === true ? (
                  <div className="svy-ans">
                    <input
                      className="svy-line"
                      type="text"
                      aria-label="기타 응답자 구분 직접 입력"
                      placeholder="직접 입력"
                      maxLength={200}
                      value={roleOther}
                      disabled={pending}
                      onChange={(e) => setRoleOther(e.target.value)}
                    />
                  </div>
                ) : null
              }
            />
          ))}
        </div>
      </div>
      {notice === "failed" && (
        <div className="svy-notice" role="alert">
          <b>{NOTICE_FAILED}</b>
        </div>
      )}
      <div className="svy-nav">
        <button type="button" className="svy-btn" disabled>
          이전 쪽
        </button>
        <button type="button" className="svy-btn svy-btn--primary" disabled={pending} onClick={submit}>
          {pending ? "제출하는 중…" : "제출하기"}
        </button>
      </div>
    </div>
  );
}

function RoleOption({
  label,
  checked,
  disabled,
  inputRef,
  onChange,
  other,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onChange: (checked: boolean) => void;
  other: React.ReactNode;
}) {
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

export function SurveyApp({ initialView }: { initialView: "form" | "revisit" }) {
  // initialView 는 마운트 때 한 번만 읽는다. 제출 뒤 쿠키가 생겨 서버가 "revisit" 을 다시 넘겨도 화면은 그대로.
  const [view, setView] = useState<View>(initialView);
  // 새로 작성 = 폼을 새로 마운트(빈 입력·새 제출 id)
  const [formKey, setFormKey] = useState(0);
  const [closedAtLabel, setClosedAtLabel] = useState("");

  function freshForm() {
    setFormKey((k) => k + 1);
    setView("form");
  }

  switch (view) {
    case "done":
      return <DonePaper onRewrite={freshForm} />;
    case "revisit":
      return <RevisitPaper onShowDone={() => setView("done")} onRewrite={freshForm} />;
    case "closed":
      return <ClosedPaper closedAtLabel={closedAtLabel} notSubmitted />;
    case "form":
      return (
        <SurveyForm
          key={formKey}
          onDone={() => setView("done")}
          onClosed={(label) => {
            setClosedAtLabel(label);
            setView("closed");
          }}
        />
      );
  }
}
