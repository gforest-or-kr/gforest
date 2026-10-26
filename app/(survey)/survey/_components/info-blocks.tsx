import type { Item } from "@/lib/survey/types";

// 읽기 전용 항목(값 없음): Q4 회원 그룹 점선 리더 목록, 안내/경고 문단. 훅 없음.

type LeaderItem = Extract<Item, { type: "leader-list" }>;
type NoteItem = Extract<Item, { type: "note" }>;

export function LeaderList({ item }: { item: LeaderItem }) {
  return (
    <div className="svy-lead-box">
      <div className="svy-box-h">
        <span>{item.head[0]}</span>
        <span>{item.head[1]}</span>
      </div>
      <ul>
        {item.rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <span>
              {r.value}
              {item.unit ?? ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 경고는 .svy-warn(앞의 "※ " 는 CSS), 그 밖의 안내는 14px 보조 문단
export function Note({ item }: { item: NoteItem }) {
  return <p className={item.tone === "warn" ? "svy-warn" : "svy-sm"}>{item.text}</p>;
}
