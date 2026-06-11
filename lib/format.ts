// 날짜 표기 헬퍼 — 목록은 MM.DD, 본문은 YYYY.MM.DD HH:mm (KST)
const KST = "Asia/Seoul";

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    timeZone: KST,
    month: "2-digit",
    day: "2-digit",
  }).replace(/\. ?/g, ".").replace(/\.$/, "");
}

export function fullDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ko-KR", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
