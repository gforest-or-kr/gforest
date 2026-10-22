"use client";

import { useId, type KeyboardEvent } from "react";
import { TEXT_MAX, TEXTAREA_MAX } from "@/lib/survey/validate";
import type { Item, ItemValue, TextValue } from "@/lib/survey/types";

// 한 줄 입력·여러 줄 입력. 값이 비면 undefined 를 올려 보내 상위가 항목 키를 지운다(빈 값은 저장하지 않음).

type TextItem = Extract<Item, { type: "text" }>;
type TextareaItem = Extract<Item, { type: "textarea" }>;

// form 요소가 없어 Enter 로 제출·이동될 일은 없지만, 한 줄 입력의 Enter 는 명시적으로 아무 일도 하지 않게 막는다
export function preventEnter(e: KeyboardEvent<HTMLInputElement>): void {
  if (e.key === "Enter") e.preventDefault();
}

function readText(v: ItemValue | undefined): string {
  return v !== undefined && "text" in v && typeof v.text === "string" ? v.text : "";
}

function isSkipped(v: ItemValue | undefined): boolean {
  return v !== undefined && "skip" in v && v.skip === true;
}

interface TextLineProps {
  item: TextItem;
  value: ItemValue | undefined;
  onChange: (v: TextValue | undefined) => void;
  disabled: boolean;
}

export function TextLine({ item, value, onChange, disabled }: TextLineProps) {
  const id = useId();
  const skipped = isSkipped(value);
  return (
    <>
      <div className="svy-free">
        <label htmlFor={id}>{item.label}</label>
        <input
          id={id}
          className="svy-line"
          type="text"
          maxLength={TEXT_MAX}
          value={skipped ? "" : readText(value)}
          disabled={disabled || skipped}
          onKeyDown={preventEnter}
          onChange={(e) => onChange(e.target.value === "" ? undefined : { text: e.target.value })}
        />
      </div>
      {item.skip === true && (
        <div className="svy-opts">
          <label className="svy-opt svy-opt--check">
            <input
              type="checkbox"
              checked={skipped}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked ? { skip: true } : undefined)}
            />
            <span className="svy-no-cell">
              <span className="svy-no" aria-hidden="true" />
            </span>
            <span className="svy-opt-t">미정 / 모름</span>
          </label>
        </div>
      )}
    </>
  );
}

interface TextAreaProps {
  item: TextareaItem;
  value: ItemValue | undefined;
  onChange: (v: { text: string } | undefined) => void;
  disabled: boolean;
}

export function TextArea({ item, value, onChange, disabled }: TextAreaProps) {
  const id = useId();
  return (
    <div className="svy-free">
      <label htmlFor={id}>{item.label}</label>
      <textarea
        id={id}
        className="svy-area"
        rows={item.rows ?? 3}
        maxLength={TEXTAREA_MAX}
        value={readText(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? undefined : { text: e.target.value })}
      />
    </div>
  );
}
