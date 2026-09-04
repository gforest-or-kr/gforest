import type { Database } from "./db/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type BoardRow = Pick<
  Database["public"]["Tables"]["boards"]["Row"],
  "slug" | "name" | "menu_group" | "sort_order" | "read_roles" | "board_type"
>;
type StaticPageRow = Pick<
  Database["public"]["Tables"]["static_pages"]["Row"],
  "slug" | "title" | "menu_group" | "sort_order"
>;

export type MenuItem = { href: string; label: string };
export type MenuGroup = { key: string; label: string; items: MenuItem[] };

// 메뉴 그룹 순서·표시명 (IA: screen_design.md §2)
const GROUP_ORDER: { key: string; label: string }[] = [
  { key: "학교소개", label: "학교소개" },
  { key: "학교소식", label: "학교소식" },
  { key: "커뮤니티", label: "커뮤니티" },
  { key: "학부모학생", label: "학부모·학생" },
  { key: "운영위교사", label: "운영위·교사" },
];

// UI 노출 제어용 — 실제 차단은 RLS가 담당 (CLAUDE.md 원칙 3)
export function canReadBoard(
  readRoles: AppRole[] | null,
  role: AppRole | null,
): boolean {
  if (readRoles === null) return true; // 공개
  if (!role) return false;
  if (role === "admin") return true;
  return readRoles.includes(role);
}

export function buildMenu(
  boards: BoardRow[],
  staticPages: StaticPageRow[],
  role: AppRole | null,
): MenuGroup[] {
  return GROUP_ORDER.map(({ key, label }) => {
    const items: MenuItem[] =
      key === "학교소개"
        ? staticPages
            .filter((p) => p.menu_group === key)
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((p) => ({ href: `/intro/${p.slug}`, label: p.title }))
        : boards
            .filter(
              (b) => b.menu_group === key && canReadBoard(b.read_roles, role),
            )
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((b) => ({ href: `/boards/${b.slug}`, label: b.name }));
    return { key, label, items };
  }).filter((g) => g.items.length > 0);
}

export const ROLE_LABEL: Record<AppRole, string> = {
  pending: "승인 대기",
  member: "일반회원",
  operator: "운영위원",
  teacher: "교사",
  student: "학생",
  admin: "관리자",
};
