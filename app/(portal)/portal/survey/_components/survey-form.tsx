"use client";

import { useEffect, useId, useRef, useState, useTransition, type ReactNode, type Ref } from "react";
import { unstable_isUnrecognizedActionError } from "next/navigation";
import { getSurvey } from "@/lib/survey/surveys";
import { parseDraft, ROLE_OTHER_MAX } from "@/lib/survey/validate";
import type { ItemValue, QuestionValue, RespondentRole } from "@/lib/survey/types";
import { submitSurvey, type SubmitResult } from "../actions";
import { clearDraft, DRAFT_UNAVAILABLE, writeDraft, type DraftFields } from "./draft";
import { PaperHead } from "./papers";
import { QuestionBlock } from "./question-block";
import { preventEnter } from "./text-fields";

// 질의서 작성 화면(11쪽 = 0~10절). 입력 상태는 전부 이 컴포넌트 최상단에 두고 쪽은 props 로만 그린다
// (쪽을 넘겨 언마운트돼도 값이 남는다). form 요소 없음 — 모든 버튼 type="button", Enter 로 이동·제출되지 않는다.
// 임시 저장: 처음 값은 SurveyApp 이 읽어 준 저장본(initialRaw)을 정규화해 한 번만 쓴다. 저장은 이벤트 핸들러에서만
// (입력 500ms 디바운스, 쪽 이동·제출 시 즉시, pagehide 때 남은 것) — effect 안에서 setState 하지 않는다.

const NOTICE_NO_ROLES = "※ 응답자 구분을 하나 이상 선택해 주세요.";
const NOTICE_FAILED = "제출하지 못했어요. 입력하신 내용은 그대로 남아 있어요. 잠시 뒤 다시 눌러 주세요.";
// 배포로 서버 액션 id 가 바뀐 뒤(이 화면을 배포 전에 열어 둔 경우) — 다시 눌러도 계속 실패하므로 새로고침을 안내한다
const NOTICE_STALE =
  "화면이 새 버전으로 바뀌어 제출하지 못했어요. 페이지를 새로고침한 뒤 다시 제출해 주세요. 입력하신 내용은 이 기기에 저장돼 있어 새로고침해도 그대로 돌아와요.";
const NOTICE_STALE_NO_STORAGE =
  "화면이 새 버전으로 바뀌어 제출하지 못했어요. 이 기기에서는 임시 저장을 쓸 수 없어 새로고침하면 입력하신 내용이 지워져요. 긴 글은 따로 옮겨 적어 두신 뒤 새로고침해 주세요.";
const SAVE_DEBOUNCE_MS = 500;
const FLASH_MS = 700;

type Notice = "none" | "no_roles" | "failed" | "stale";
type Answers = Record<string, QuestionValue>;
type SaveStatus = { kind: "idle" } | { kind: "saved"; time: string } | { kind: "unavailable" };
type Timer = ReturnType<typeof setTimeout>;

// 항목 값 하나를 바꾼 새 answers. undefined = 항목 키 삭제, 항목이 모두 비면 질문 자체를 뺀다(불변 갱신)
function withItem(answers: Answers, qid: string, itemKey: string, v: ItemValue | undefined): Answers {
  const rest = Object.fromEntries(Object.entries(answers[qid] ?? {}).filter(([k]) => k !== itemKey));
  const nextQ: QuestionValue = v === undefined ? rest : { ...rest, [itemKey]: v };
  const others = Object.fromEntries(Object.entries(answers).filter(([k]) => k !== qid));
  return Object.keys(nextQ).length === 0 ? others : { ...others, [qid]: nextQ };
}

// 기기 로컬 24시간 HH:MM
function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function statusText(s: SaveStatus): string {
  if (s.kind === "saved") return `자동 저장됨 ${s.time}`;
  if (s.kind === "unavailable") return "이 기기에서는 임시 저장을 쓸 수 없어요";
  return "자동 저장 대기 중";
}

// 자동 저장. 타이머·대기 중인 저장본은 ref 에 두고 핸들러·타이머 콜백에서만 읽고 쓴다(렌더 중 접근 없음).
function useAutosave(slug: string, storageOk: boolean) {
  const [status, setStatus] = useState<SaveStatus>(storageOk ? { kind: "idle" } : { kind: "unavailable" });
  const [flash, setFlash] = useState(false);
  const box = useRef<{ save: Timer | null; flash: Timer | null; snap: DraftFields | null }>({
    save: null,
    flash: null,
    snap: null,
  });

  // 탭을 닫거나 다른 곳으로 갈 때 디바운스 중인 저장본을 바로 쓴다. 언마운트 때 타이머 정리.
  useEffect(() => {
    const timers = box.current;
    const onHide = () => {
      if (storageOk && timers.snap) writeDraft(slug, timers.snap);
      timers.snap = null;
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      if (timers.save) clearTimeout(timers.save);
      if (timers.flash) clearTimeout(timers.flash);
    };
  }, [slug, storageOk]);

  function persist(snap: DraftFields) {
    if (!storageOk) return;
    if (!writeDraft(slug, snap)) {
      setStatus({ kind: "unavailable" });
      return;
    }
    setStatus({ kind: "saved", time: hhmm(new Date()) });
    setFlash(true);
    const timers = box.current;
    if (timers.flash) clearTimeout(timers.flash);
    timers.flash = setTimeout(() => setFlash(false), FLASH_MS);
  }

  function cancel() {
    const timers = box.current;
    if (timers.save) clearTimeout(timers.save);
    timers.save = null;
    timers.snap = null;
  }

  function schedule(snap: DraftFields) {
    const timers = box.current;
    if (timers.save) clearTimeout(timers.save);
    timers.snap = snap;
    timers.save = setTimeout(() => {
      const pendingSnap = timers.snap;
      timers.save = null;
      timers.snap = null;
      if (pendingSnap) persist(pendingSnap);
    }, SAVE_DEBOUNCE_MS);
  }

  function flush(snap: DraftFields) {
    cancel();
    persist(snap);
  }

  return { status, flash, schedule, flush, cancel };
}

interface SurveyFormProps {
  slug: string;
  initialRaw: string;
  onDone: () => void;
  onClosed: (closedAtLabel: string) => void;
}

export function SurveyForm({ slug, initialRaw, onDone, onClosed }: SurveyFormProps) {
  // 문항은 레지스트리(순수 데이터)에서 — 페이지가 이미 slug 를 검증했지만 여기서도 없으면 그리지 않는다
  const def = getSurvey(slug);
  if (!def) throw new Error(`unknown survey: ${slug}`);
  const { questions: QUESTIONS, roles: RESPONDENT_ROLES, sections: SECTIONS } = def;
  const LAST_PAGE = SECTIONS.length - 1;
  // 저장본은 신뢰하지 않는다: 제출과 같은 정규화로 낡은 문항·보기 키, 한도 초과 값을 버린 뒤 초깃값으로만 쓴다
  const [draft] = useState(() => parseDraft(initialRaw, QUESTIONS, RESPONDENT_ROLES));
  const [page, setPage] = useState(() => (draft !== null && draft.roles.length > 0 ? draft.page : 0));
  const [roles, setRoles] = useState<readonly string[]>(() => draft?.roles ?? []);
  const [roleOther, setRoleOther] = useState(() => draft?.roleOther ?? "");
  const [answers, setAnswers] = useState<Answers>(() => draft?.answers ?? {});
  const [notice, setNotice] = useState<Notice>("none");
  const [pending, startTransition] = useTransition();
  const saver = useAutosave(slug, initialRaw !== DRAFT_UNAVAILABLE);
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

  function snapshot(over: Partial<DraftFields>): DraftFields {
    return { page, roles: [...roles], roleOther, answers, ...over };
  }

  function toggleRole(key: string, checked: boolean, isOther: boolean) {
    // 정의 순서를 유지한 새 배열(불변 갱신)
    const nextRoles = RESPONDENT_ROLES.filter((r) => (r.key === key ? checked : roles.includes(r.key))).map((r) => r.key);
    const nextOther = isOther && !checked ? "" : roleOther;
    setRoles(nextRoles);
    setRoleOther(nextOther);
    if (checked && notice === "no_roles") setNotice("none");
    saver.schedule(snapshot({ roles: nextRoles, roleOther: nextOther }));
  }

  function changeRoleOther(text: string) {
    setRoleOther(text);
    saver.schedule(snapshot({ roleOther: text }));
  }

  function setItem(qid: string, itemKey: string, v: ItemValue | undefined) {
    const next = withItem(answers, qid, itemKey, v);
    setAnswers(next);
    saver.schedule(snapshot({ answers: next }));
  }

  function goTo(next: number) {
    if (page === 0 && next > 0 && roles.length === 0) {
      setNotice("no_roles");
      firstRole.current?.focus();
      return;
    }
    setNotice("none");
    setPage(next);
    saver.flush(snapshot({ page: next }));
  }

  function submit() {
    if (roles.length === 0) {
      goTo(0);
      setNotice("no_roles");
      return;
    }
    saver.flush(snapshot({}));
    submissionId.current ??= crypto.randomUUID();
    const payload = { submissionId: submissionId.current, roles: [...roles], roleOther, answers };
    setNotice("none");
    startTransition(async () => {
      // 네트워크 끊김 등으로 액션 호출 자체가 실패해도 오류 화면이 아니라 같은 쪽 안내로 끝낸다(입력·임시 저장본 유지)
      let r: SubmitResult;
      try {
        r = await submitSurvey(slug, payload);
      } catch (err) {
        setNotice(unstable_isUnrecognizedActionError(err) ? "stale" : "failed");
        return;
      }
      if (r.ok) {
        saver.cancel();
        clearDraft(slug);
        onDone();
      }
      // 작성 도중 마감: 서버가 거절 → 마감 화면 + "제출되지 않았어요". 임시 저장본은 지우지 않는다(마감 뒤에도 내용을 볼 수 있게).
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
        <span className="svy-saved" aria-live="off" data-flash={saver.flash ? "true" : undefined}>
          {statusText(saver.status)}
        </span>
      </div>
      {page === 0 && <PaperHead />}
      <h2 className="svy-sec" tabIndex={-1} ref={heading}>
        {section.no}. {section.title}
      </h2>
      {page === 0 ? (
        <RolesBox
          options={RESPONDENT_ROLES}
          roles={roles}
          roleOther={roleOther}
          disabled={pending}
          firstRef={firstRole}
          showAlert={notice === "no_roles"}
          onToggle={toggleRole}
          onOther={changeRoleOther}
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
      {notice === "stale" && (
        <div className="svy-notice" role="alert">
          <b>{saver.status.kind === "unavailable" ? NOTICE_STALE_NO_STORAGE : NOTICE_STALE}</b>
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
  options: readonly RespondentRole[];
  roles: readonly string[];
  roleOther: string;
  disabled: boolean;
  firstRef: Ref<HTMLInputElement>;
  showAlert: boolean;
  onToggle: (key: string, checked: boolean, isOther: boolean) => void;
  onOther: (text: string) => void;
}

// 0절 응답자 구분(필수, 다중). 기타를 고르면 직접 입력칸이 펼쳐진다.
function RolesBox({ options, roles, roleOther, disabled, firstRef, showAlert, onToggle, onOther }: RolesBoxProps) {
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
          {options.map((r, i) => (
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
