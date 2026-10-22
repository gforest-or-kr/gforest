"use client";

import { Fragment, useId, type ReactNode } from "react";
import type { Item, ItemValue, Question, QuestionValue } from "@/lib/survey/types";
import { ChoiceGroup } from "./choice-group";
import { TextArea, TextLine } from "./text-fields";

// 질문 한 개 = 머리글(번호·문구) + 리드 + 항목들. 항목은 item.type 으로만 고른다 — 질문 id 로 분기하지 않는다
// (문항 변경은 lib/survey/questions*.ts 데이터만 고치면 화면에 반영된다).

const MULTI_SUFFIX = " (여러 개 선택 가능)";

interface QuestionBlockProps {
  question: Question;
  value: QuestionValue | undefined;
  onChange: (itemKey: string, v: ItemValue | undefined) => void;
  disabled: boolean;
}

function itemTitle(item: Item): string | null {
  if ((item.type !== "single" && item.type !== "multi") || !item.title) return null;
  if (item.type === "multi" && !item.title.includes(MULTI_SUFFIX.trim())) return item.title + MULTI_SUFFIX;
  return item.title;
}

export function QuestionBlock({ question, value, onChange, disabled }: QuestionBlockProps) {
  const baseId = useId();
  const titleId = `${baseId}-t`;
  return (
    <div className="svy-q">
      <h3 className="svy-qh" id={titleId}>
        <span className="svy-qn">{question.no === null ? "" : `${question.no}.`}</span>
        <span>{question.title}</span>
      </h3>
      {question.lead?.map((line, i) => (
        <p className="svy-lead" key={i}>
          {line}
        </p>
      ))}
      {question.items.map((item, i) => {
        const key = "key" in item ? item.key : `${item.type}-${i}`;
        const title = itemTitle(item);
        const subId = `${baseId}-s${i}`;
        const body = (
          <ItemView
            name={`${question.id}-${key}`}
            item={item}
            value={"key" in item ? value?.[item.key] : undefined}
            onChange={(v) => onChange(key, v)}
            disabled={disabled}
            labelledBy={title === null ? titleId : subId}
          />
        );
        if (title === null) return <Fragment key={key}>{body}</Fragment>;
        return (
          <div className="svy-subq" key={key}>
            <p className="svy-sh" id={subId}>
              {title}
            </p>
            {body}
          </div>
        );
      })}
    </div>
  );
}

interface ItemViewProps {
  name: string;
  item: Item;
  value: ItemValue | undefined;
  onChange: (v: ItemValue | undefined) => void;
  disabled: boolean;
  labelledBy: string;
}

function ItemView({ name, item, value, onChange, disabled, labelledBy }: ItemViewProps): ReactNode {
  switch (item.type) {
    case "single":
    case "multi":
      return (
        <ChoiceGroup
          name={name}
          item={item}
          value={value}
          onChange={onChange}
          disabled={disabled}
          labelledBy={labelledBy}
        />
      );
    case "text":
      return <TextLine item={item} value={value} onChange={onChange} disabled={disabled} />;
    case "textarea":
      return <TextArea item={item} value={value} onChange={onChange} disabled={disabled} />;
    case "boards":
    case "cards":
    case "leader-list":
    case "note":
      return null;
  }
  const unreachable: never = item;
  return unreachable;
}
