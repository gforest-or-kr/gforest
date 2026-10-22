"use client";

import { Fragment, useId } from "react";
import { TEXT_MAX } from "@/lib/survey/validate";
import type { Blank, Choice, Item, ItemValue, MultiValue, SingleValue } from "@/lib/survey/types";
import { preventEnter } from "./text-fields";

// OMR 보기 묶음. 단일 = 원형 버블 ①…⑩ + 선택 지우기, 다중 = 네모 마커. 보기에 blank 가 있으면 그 보기가
// 선택됐을 때만 바로 아래에 입력칸을 펼치고, 선택이 풀리면 값도 함께 버린다(값 모양은 lib/survey/types.ts).

// 문항 데이터 순서대로 번호 글자(최대 10개 — 문항 검증이 보기 10개 초과를 막는다)
export const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩";

export type ChoiceItem = Extract<Item, { type: "single" | "multi" }>;

export function asSingle(v: ItemValue | undefined): SingleValue | undefined {
  return v !== undefined && "choice" in v && typeof v.choice === "string" ? (v as SingleValue) : undefined;
}

function asMulti(v: ItemValue | undefined): MultiValue | undefined {
  return v !== undefined && "choices" in v && Array.isArray(v.choices) ? (v as MultiValue) : undefined;
}

interface BlankFieldProps {
  blank: Blank;
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
}

// 보기 안 빈칸 — 숫자 빈칸은 숫자만 최대 2자리(나머지 글자는 지운다)
export function BlankField({ blank, value, onChange, disabled }: BlankFieldProps) {
  const id = useId();
  return (
    <div className="svy-ans">
      <label htmlFor={id}>{blank.label}</label>
      <input
        id={id}
        className={blank.num ? "svy-line svy-line--num" : "svy-line"}
        type="text"
        inputMode={blank.num ? "numeric" : undefined}
        maxLength={blank.num ? 2 : TEXT_MAX}
        value={value}
        disabled={disabled}
        onKeyDown={preventEnter}
        onChange={(e) => onChange(blank.num ? e.target.value.replace(/\D/g, "").slice(0, 2) : e.target.value)}
      />
      {blank.post && <span>{blank.post}</span>}
    </div>
  );
}

interface OptionRowProps {
  type: "radio" | "checkbox";
  name: string;
  option: Choice;
  glyph: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function OptionRow({ type, name, option, glyph, checked, disabled, onChange }: OptionRowProps) {
  return (
    <label className={type === "radio" ? "svy-opt" : "svy-opt svy-opt--check"}>
      <input
        type={type}
        name={name}
        value={option.key}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="svy-no-cell">
        <span className="svy-no" aria-hidden="true">
          {glyph}
        </span>
      </span>
      <span className="svy-opt-t">{option.label}</span>
    </label>
  );
}

interface ChoiceGroupProps {
  name: string;
  item: ChoiceItem;
  value: ItemValue | undefined;
  onChange: (v: ItemValue | undefined) => void;
  disabled: boolean;
  labelledBy: string;
}

export function ChoiceGroup({ name, item, value, onChange, disabled, labelledBy }: ChoiceGroupProps) {
  return item.type === "single" ? (
    <SingleGroup
      name={name}
      options={item.options}
      value={asSingle(value)}
      onChange={onChange}
      disabled={disabled}
      labelledBy={labelledBy}
    />
  ) : (
    <MultiGroup
      name={name}
      options={item.options}
      value={asMulti(value)}
      onChange={onChange}
      disabled={disabled}
      labelledBy={labelledBy}
    />
  );
}

interface SingleGroupProps {
  name: string;
  options: readonly Choice[];
  value: SingleValue | undefined;
  onChange: (v: SingleValue | undefined) => void;
  disabled: boolean;
  labelledBy: string;
}

export function SingleGroup({ name, options, value, onChange, disabled, labelledBy }: SingleGroupProps) {
  return (
    <div className="svy-opts" role="radiogroup" aria-labelledby={labelledBy}>
      {options.map((o, i) => {
        const selected = value?.choice === o.key;
        return (
          <Fragment key={o.key}>
            <OptionRow
              type="radio"
              name={name}
              option={o}
              glyph={CIRCLED[i] ?? ""}
              checked={selected}
              disabled={disabled}
              onChange={(checked) => checked && onChange({ choice: o.key })}
            />
            {selected && o.blank && (
              <BlankField
                blank={o.blank}
                value={value?.blank ?? ""}
                disabled={disabled}
                onChange={(text) => onChange(text === "" ? { choice: o.key } : { choice: o.key, blank: text })}
              />
            )}
          </Fragment>
        );
      })}
      {value !== undefined && (
        <button type="button" className="svy-clear" disabled={disabled} onClick={() => onChange(undefined)}>
          선택 지우기
        </button>
      )}
    </div>
  );
}

interface MultiGroupProps {
  name: string;
  options: readonly Choice[];
  value: MultiValue | undefined;
  onChange: (v: MultiValue | undefined) => void;
  disabled: boolean;
  labelledBy: string;
}

function withoutKey(blanks: Readonly<Record<string, string>> | undefined, key: string): Record<string, string> {
  return Object.fromEntries(Object.entries(blanks ?? {}).filter(([k]) => k !== key));
}

function buildMulti(choices: string[], blanks: Record<string, string>): MultiValue | undefined {
  if (choices.length === 0) return undefined;
  return Object.keys(blanks).length === 0 ? { choices } : { choices, blanks };
}

function MultiGroup({ name, options, value, onChange, disabled, labelledBy }: MultiGroupProps) {
  const picked = value?.choices ?? [];

  function toggle(key: string, checked: boolean) {
    // 정의 순서를 유지한 새 배열, 해제한 보기의 빈칸 값은 버린다(불변 갱신)
    const choices = options.filter((o) => (o.key === key ? checked : picked.includes(o.key))).map((o) => o.key);
    const blanks = checked ? { ...(value?.blanks ?? {}) } : withoutKey(value?.blanks, key);
    onChange(buildMulti(choices, blanks));
  }

  function setBlank(key: string, text: string) {
    const blanks = text === "" ? withoutKey(value?.blanks, key) : { ...(value?.blanks ?? {}), [key]: text };
    onChange(buildMulti([...picked], blanks));
  }

  return (
    <div className="svy-opts" role="group" aria-labelledby={labelledBy}>
      {options.map((o) => {
        const selected = picked.includes(o.key);
        return (
          <Fragment key={o.key}>
            <OptionRow
              type="checkbox"
              name={name}
              option={o}
              glyph=""
              checked={selected}
              disabled={disabled}
              onChange={(checked) => toggle(o.key, checked)}
            />
            {selected && o.blank && (
              <BlankField
                blank={o.blank}
                value={value?.blanks?.[o.key] ?? ""}
                disabled={disabled}
                onChange={(text) => setBlank(o.key, text)}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
