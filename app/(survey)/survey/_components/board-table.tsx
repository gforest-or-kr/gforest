"use client";

import { useId } from "react";
import type { Blank, BoardAccess, BoardChoice, BoardRow, BoardsValue, Item, ItemValue } from "@/lib/survey/types";
import { BlankField, CIRCLED, OptionRow } from "./choice-group";

// Q1 게시판 표: 접근 권한별 3그룹(개수는 데이터에서 계산) + 행마다 유지/통합/폐지 OMR, 통합이면 "합칠 대상" 입력.
// 값 모양: { rows: { [boardKey]: { choice, target? } } } — target 은 통합일 때만.

type BoardsItem = Extract<Item, { type: "boards" }>;
type RowValue = BoardsValue["rows"][string];

const GROUPS: readonly { access: BoardAccess; label: string }[] = [
  { access: "public", label: "누구나 볼 수 있는 게시판" },
  { access: "login", label: "로그인 후 볼 수 있는 게시판" },
  { access: "restricted", label: "특정 권한이 필요한 게시판 — 실제 이용하시는 분만 표시" },
];

const ROW_CHOICES: readonly { key: BoardChoice; label: string }[] = [
  { key: "keep", label: "유지" },
  { key: "merge", label: "통합" },
  { key: "drop", label: "폐지" },
];

const MERGE_BLANK: Blank = { label: "합칠 대상:" };

function asBoards(v: ItemValue | undefined): BoardsValue["rows"] {
  return v !== undefined && "rows" in v && typeof v.rows === "object" && v.rows !== null
    ? (v as BoardsValue).rows
    : {};
}

function infoLine(row: BoardRow): string {
  const base = `${row.who} · 글 ${row.posts} · 최근 ${row.recent}`;
  return row.note ? `${base} · ${row.note}` : base;
}

interface BoardTableProps {
  name: string;
  item: BoardsItem;
  value: ItemValue | undefined;
  onChange: (v: BoardsValue | undefined) => void;
  disabled: boolean;
}

export function BoardTable({ name, item, value, onChange, disabled }: BoardTableProps) {
  const rows = asBoards(value);

  // 행 하나를 바꾼 새 값. undefined = 그 행 삭제, 행이 모두 비면 항목 자체를 뺀다(불변 갱신)
  function setRow(key: string, next: RowValue | undefined) {
    const rest = Object.fromEntries(Object.entries(rows).filter(([k]) => k !== key));
    const merged = next === undefined ? rest : { ...rest, [key]: next };
    onChange(Object.keys(merged).length === 0 ? undefined : { rows: merged });
  }

  return (
    <div>
      {GROUPS.map((g) => {
        const inGroup = item.rows.filter((r) => r.access === g.access);
        if (inGroup.length === 0) return null;
        return (
          <div key={g.access}>
            <div className="svy-grp">
              {g.label}
              <span>{inGroup.length}개</span>
            </div>
            {inGroup.map((row) => (
              <BoardRowView
                key={row.key}
                name={`${name}-${row.key}`}
                row={row}
                value={rows[row.key]}
                disabled={disabled}
                onChange={(next) => setRow(row.key, next)}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

interface BoardRowViewProps {
  name: string;
  row: BoardRow;
  value: RowValue | undefined;
  onChange: (v: RowValue | undefined) => void;
  disabled: boolean;
}

function BoardRowView({ name, row, value, onChange, disabled }: BoardRowViewProps) {
  const nameId = useId();
  return (
    <div className="svy-brd">
      <div>
        <div className="svy-brd-name" id={nameId}>
          {row.name}
        </div>
        <div className="svy-brd-info">{infoLine(row)}</div>
      </div>
      <div className="svy-ch" role="radiogroup" aria-labelledby={nameId}>
        {ROW_CHOICES.map((ch, i) => (
          <OptionRow
            key={ch.key}
            type="radio"
            name={name}
            option={{ key: ch.key, label: ch.label }}
            glyph={CIRCLED[i] ?? ""}
            checked={value?.choice === ch.key}
            disabled={disabled}
            onChange={(checked) => checked && onChange({ choice: ch.key })}
          />
        ))}
      </div>
      {value?.choice === "merge" && (
        <BlankField
          blank={MERGE_BLANK}
          value={value.target ?? ""}
          disabled={disabled}
          onChange={(text) => onChange(text === "" ? { choice: "merge" } : { choice: "merge", target: text })}
        />
      )}
      {value !== undefined && (
        <button type="button" className="svy-clear" disabled={disabled} onClick={() => onChange(undefined)}>
          선택 지우기
        </button>
      )}
    </div>
  );
}
