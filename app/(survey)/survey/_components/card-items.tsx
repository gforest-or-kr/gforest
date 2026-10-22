"use client";

import { useId } from "react";
import { TEXT_MAX } from "@/lib/survey/validate";
import type { CardDef, CardsValue, Item, ItemValue, SingleValue } from "@/lib/survey/types";
import { SingleGroup } from "./choice-group";
import { preventEnter } from "./text-fields";

// Q5 항목 상자: 카드마다 이름·메타 + 용도(한 줄 입력) + 처리(단일 선택, 보기 안 빈칸 포함).
// 값 모양: { [cardKey]: { purpose?, choice?, blank? } } — 빈 카드는 키를 지우고, 모두 비면 항목을 뺀다.

type CardsItem = Extract<Item, { type: "cards" }>;
type CardValue = CardsValue[string];

function asCards(v: ItemValue | undefined): CardsValue {
  if (v === undefined || "choice" in v || "choices" in v || "text" in v || "skip" in v || "rows" in v) return {};
  return v as CardsValue;
}

function compact(c: CardValue): CardValue | undefined {
  const next: CardValue = {
    ...(c.purpose ? { purpose: c.purpose } : {}),
    ...(c.choice ? { choice: c.choice } : {}),
    ...(c.choice && c.blank ? { blank: c.blank } : {}),
  };
  return Object.keys(next).length === 0 ? undefined : next;
}

interface CardItemsProps {
  name: string;
  item: CardsItem;
  value: ItemValue | undefined;
  onChange: (v: CardsValue | undefined) => void;
  disabled: boolean;
}

export function CardItems({ name, item, value, onChange, disabled }: CardItemsProps) {
  const cards = asCards(value);

  function setCard(key: string, next: CardValue | undefined) {
    const rest = Object.fromEntries(Object.entries(cards).filter(([k]) => k !== key));
    const merged = next === undefined ? rest : { ...rest, [key]: next };
    onChange(Object.keys(merged).length === 0 ? undefined : merged);
  }

  return (
    <>
      {item.cards.map((card) => (
        <CardBox
          key={card.key}
          name={`${name}-${card.key}`}
          card={card}
          value={cards[card.key]}
          disabled={disabled}
          onChange={(next) => setCard(card.key, next)}
        />
      ))}
    </>
  );
}

interface CardBoxProps {
  name: string;
  card: CardDef;
  value: CardValue | undefined;
  onChange: (v: CardValue | undefined) => void;
  disabled: boolean;
}

function CardBox({ name, card, value, onChange, disabled }: CardBoxProps) {
  const nameId = useId();
  const purposeId = useId();
  const current = value ?? {};
  const single: SingleValue | undefined = current.choice
    ? { choice: current.choice, ...(current.blank ? { blank: current.blank } : {}) }
    : undefined;

  return (
    <div className="svy-item">
      <div className="svy-item-h">
        <b id={nameId}>{card.name}</b>
        <span>{card.meta}</span>
      </div>
      <div className="svy-item-b">
        <div className="svy-free">
          <label htmlFor={purposeId}>{card.purposeLabel}</label>
          <input
            id={purposeId}
            className="svy-line"
            type="text"
            maxLength={TEXT_MAX}
            value={current.purpose ?? ""}
            disabled={disabled}
            onKeyDown={preventEnter}
            onChange={(e) => onChange(compact({ ...current, purpose: e.target.value }))}
          />
        </div>
        <SingleGroup
          name={name}
          options={card.options}
          value={single}
          disabled={disabled}
          labelledBy={nameId}
          onChange={(sv) => onChange(compact({ purpose: current.purpose, choice: sv?.choice, blank: sv?.blank }))}
        />
      </div>
    </div>
  );
}
