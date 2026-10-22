"use client";

import { useId, useRef, useState, useTransition } from "react";
import { RESPONDENT_ROLES, SECTIONS } from "@/lib/survey/questions";
import { submitSurvey } from "../actions";

// 질의서 응답 화면(클라이언트). 첫 화면은 서버가 정해 initialView 로 넘긴다 — 초깃값으로만 쓰고
// 이후 prop 으로 화면을 다시 파생하지 않는다(서버 액션이 쿠키를 심으면 페이지가 다시 렌더되기 때문).
// form 요소를 쓰지 않는다: 모든 버튼은 type="button", Enter 로 제출되지 않는다.

type View = "form" | "done";

const NOTICE_NO_ROLES = "※ 응답자 구분을 하나 이상 선택해 주세요.";
const NOTICE_FAILED = "제출하지 못했어요. 입력하신 내용은 그대로 남아 있어요. 잠시 뒤 다시 눌러 주세요.";

function Head() {
  return (
    <>
      <h1 className="svy-title">새 홈페이지 이해관계자 의견 조사</h1>
      <p className="svy-subtitle">푸른숲발도르프학교</p>
      <hr className="svy-rule" />
    </>
  );
}

function Done({ onRewrite }: { onRewrite: () => void }) {
  return (
    <div className="svy-paper">
      <Head />
      <p className="svy-stamp">
        <span>제 출 완 료</span>
      </p>
      <div className="svy-center">
        <p>의견을 보내 주셔서 감사합니다.</p>
        <p>보내신 내용은 이 화면에서 수정할 수 없어요.</p>
      </div>
      <div className="svy-notice">
        <b>※ 같은 분이 다시 제출하셔도 막지는 않지만,</b>
        결과를 볼 때 중복 응답으로 표시될 수 있어요. 잘못 보내셨다면 다시 한 번 제출해 주세요.
      </div>
      <div className="svy-center">
        <button type="button" className="svy-btn" onClick={onRewrite}>
          다시 작성하기
        </button>
      </div>
    </div>
  );
}

type Notice = "none" | "no_roles" | "failed";

function SurveyForm({ onDone }: { onDone: () => void }) {
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
      const r = await submitSurvey(payload);
      if (r.ok) onDone();
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
      <Head />
      <div className="svy-how">
        <ul>
          <li>본인이 답할 수 있는 문항만 답해 주세요. 잘 모르시면 비워 두시거나 &quot;미정 / 모름&quot;에 표시하세요.</li>
          <li>해당하는 번호를 눌러 표시합니다. 보기에 없는 생각은 &quot;기타&quot; 칸에 적어 주세요.</li>
          <li>
            쓰신 내용은 <b>이 기기의 브라우저에 자동으로 임시 저장</b>됩니다. 제출하기 전까지는 서버로 보내지지 않아요.
          </li>
        </ul>
      </div>
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
  const [view, setView] = useState<View>(initialView === "revisit" ? "form" : initialView);
  // 다시 작성하기 = 폼을 새로 마운트(빈 입력·새 제출 id)
  const [formKey, setFormKey] = useState(0);

  if (view === "done") {
    return (
      <Done
        onRewrite={() => {
          setFormKey((k) => k + 1);
          setView("form");
        }}
      />
    );
  }
  return <SurveyForm key={formKey} onDone={() => setView("done")} />;
}
