import { getSessionUserId } from "@/lib/auth";
import { withUser, many } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/menu";
import { createBoard, updateBoard } from "./actions";
import type { Database } from "@/lib/db/types";

type Board = Database["public"]["Tables"]["boards"]["Row"];
const ROLE_OPTS = ["member", "operator", "teacher", "student"] as const;
const TYPES: [Board["board_type"], string][] = [
  ["list", "목록"],
  ["gallery", "갤러리"],
  ["calendar", "캘린더"],
  ["reservation", "예약"],
];

const input = "border border-slate-200 rounded-xl text-sm px-3 py-2 bg-white";

// 생성·수정 폼 공용 필드(서버 컴포넌트, 클라 상태 없음). b 없으면 생성 폼.
function Fields({ b }: { b?: Board }) {
  const publicRead = b ? b.read_roles === null : true;
  const read = (r: string) => (b?.read_roles ?? []).includes(r as never);
  const write = (r: string) => (b?.write_roles ?? ["member", "operator", "teacher"]).includes(r as never);
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap gap-2">
        {b ? (
          <input value={b.slug} disabled className={`${input} grow min-w-40 bg-slate-50 text-slate-400`} />
        ) : (
          <input name="slug" required placeholder="슬러그 (영문/숫자/-)" className={`${input} grow min-w-40`} />
        )}
        <input name="name" defaultValue={b?.name} required placeholder="게시판 이름" className={`${input} grow min-w-40`} />
      </div>
      <div className="flex flex-wrap gap-2">
        <input name="menu_group" defaultValue={b?.menu_group} required placeholder="메뉴 그룹 (예: 커뮤니티)" className={`${input} grow min-w-40`} />
        <input name="sort_order" type="number" defaultValue={b?.sort_order ?? 0} placeholder="정렬" className={`${input} w-24`} />
        <select name="board_type" defaultValue={b?.board_type ?? "list"} className={input}>
          {TYPES.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="public_read" defaultChecked={publicRead} className="w-4 h-4 accent-forest-600" />
        <span className="font-medium">공개 읽기 (비로그인 포함 전체) — 켜면 아래 읽기 역할은 무시</span>
      </label>

      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-slate-500 w-16">읽기 역할</span>
        {ROLE_OPTS.map((r) => (
          <label key={r} className="flex items-center gap-1.5">
            <input type="checkbox" name={`read_${r}`} defaultChecked={read(r)} className="w-4 h-4 accent-forest-600" />
            {ROLE_LABEL[r]}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-slate-500 w-16">쓰기 역할</span>
        {ROLE_OPTS.map((r) => (
          <label key={r} className="flex items-center gap-1.5">
            <input type="checkbox" name={`write_${r}`} defaultChecked={write(r)} className="w-4 h-4 accent-forest-600" />
            {ROLE_LABEL[r]}
          </label>
        ))}
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={b ? b.is_active : true} className="w-4 h-4 accent-forest-600" />
        <span className="font-medium">활성 (메뉴·목록에 노출)</span>
      </label>
      <p className="text-xs text-slate-400">관리자(admin)는 권한 설정과 무관하게 항상 읽기·쓰기가 허용됩니다.</p>
    </div>
  );
}

// SCR-603 게시판 관리 — admin 전용(차단: admin 레이아웃 + boards_admin RLS). 게시판 추가/권한은
// 데이터로 처리(CLAUDE.md #5) — 이 화면이 boards 테이블 CRUD를 대신해 SQL 수동 편집을 없앤다.
export default async function AdminBoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const boards = await withUser(await getSessionUserId(), (c) =>
    many<Board>(
      c,
      `select id, slug, name, description, menu_group, sort_order, board_type, read_roles, write_roles,
              is_active, legacy_mid, created_at::text as created_at
         from boards order by menu_group, sort_order`,
    ),
  );

  return (
    <main className="pb-16">
      {error && <p className="mt-4 rounded-2xl bg-red-50 text-red-600 text-sm px-4 py-3">{error}</p>}

      <section className="mt-6">
        <h2 className="font-bold mb-1">
          게시판 <span className="text-slate-400 font-normal text-sm">{boards.length}개</span>
        </h2>
        <p className="text-xs text-slate-400 mb-3">
          슬러그는 글 URL에 쓰이므로 생성 후 변경 불가. 게시판을 없애려면 &apos;활성&apos;을 꺼 숨깁니다(글은 보존).
        </p>
        <ul className="grid gap-2.5">
          {boards.map((b) => (
            <li key={b.id}>
              <details className="rounded-2xl border border-slate-100">
                <summary className="cursor-pointer px-4 py-3 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold">{b.name}</span>
                  <span className="text-slate-400">/{b.slug}</span>
                  <span className="text-xs text-slate-400">· {b.menu_group}</span>
                  <span className="text-xs text-slate-400">· {TYPES.find((t) => t[0] === b.board_type)?.[1]}</span>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${b.read_roles === null ? "bg-sky-50 text-sky-600" : "bg-amber-50 text-amber-700"}`}>
                    {b.read_roles === null ? "공개" : "회원"}
                  </span>
                  {!b.is_active && <span className="text-[11px] text-slate-400">비활성</span>}
                </summary>
                <form action={updateBoard.bind(null, b.id)} className="px-4 pb-4 grid gap-3">
                  <Fields b={b} />
                  <div className="flex justify-end">
                    <button className="bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold px-5 py-2 rounded-xl">저장</button>
                  </div>
                </form>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-bold mb-3">새 게시판 추가</h2>
        <form action={createBoard} className="rounded-2xl border border-forest-100 bg-forest-50/40 p-4 grid gap-3">
          <Fields />
          <div className="flex justify-end">
            <button className="bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold px-5 py-2 rounded-xl">추가</button>
          </div>
        </form>
      </section>
    </main>
  );
}
