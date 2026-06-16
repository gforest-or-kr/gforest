import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL } from "@/lib/menu";
import { shortDate, fullDate } from "@/lib/format";
import { updateRole } from "./actions";
import type { Database } from "@/lib/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
const ROLES: AppRole[] = ["pending", "member", "operator", "teacher", "student", "admin"];

// SCR-600 회원·역할 승인 — 기존 등업게시판 워크플로 대체
export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errMsg } = await searchParams;
  const supabase = await createClient();
  const [{ data: profiles }, { data: audit }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, nickname, role, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("role_audit")
      .select("id, old_role, new_role, changed_at, user:profiles!role_audit_user_id_fkey(nickname)")
      .order("changed_at", { ascending: false })
      .limit(10),
  ]);

  const members = profiles ?? [];
  const pending = members.filter((m) => m.role === "pending");
  const others = members.filter((m) => m.role !== "pending");

  function MemberRow({ m }: { m: (typeof members)[number] }) {
    const action = updateRole.bind(null, m.id);
    return (
      <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
        <span className="w-9 h-9 rounded-full bg-forest-100 text-forest-700 grid place-items-center text-sm font-bold shrink-0">
          {m.nickname.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">
            {m.nickname} <span className="text-slate-400 font-normal">({m.name || "이름 없음"})</span>
          </p>
          <p className="text-xs text-slate-400">가입 {shortDate(m.created_at)}</p>
        </div>
        <form action={action} className="ml-auto flex items-center gap-2">
          <select
            name="role"
            defaultValue={m.role}
            className="border border-slate-200 rounded-xl text-sm px-3 py-2 bg-white"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          <button className="bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl">
            적용
          </button>
        </form>
      </li>
    );
  }

  return (
    <main className="pb-16">
      {errMsg && (
        <p className="mt-4 rounded-2xl bg-red-50 text-red-600 text-sm px-4 py-3">{errMsg}</p>
      )}
      <section className="mt-6">
        <h2 className="font-bold mb-1">
          승인 대기{" "}
          <span className="text-forest-600">{pending.length}</span>
        </h2>
        <p className="text-xs text-slate-400 mb-2">
          조합원 확인 후 역할을 부여하면 회원 게시판을 이용할 수 있습니다
        </p>
        {pending.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400 rounded-2xl bg-slate-50">
            대기 중인 가입 신청이 없습니다
          </p>
        ) : (
          <ul className="divide-y divide-slate-50 rounded-2xl border border-amber-100 bg-amber-50/40 px-4">
            {pending.map((m) => (
              <MemberRow key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-bold mb-2">
          전체 회원 <span className="text-slate-400 font-normal text-sm">{members.length}명</span>
        </h2>
        <ul className="divide-y divide-slate-50">
          {others.map((m) => (
            <MemberRow key={m.id} m={m} />
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-bold mb-2 text-sm text-slate-500">최근 역할 변경 이력</h2>
        {(audit ?? []).length === 0 ? (
          <p className="text-xs text-slate-400">이력이 없습니다</p>
        ) : (
          <ul className="text-xs text-slate-500 space-y-1.5">
            {(audit ?? []).map((a) => {
              const user = a.user as { nickname: string } | null;
              return (
                <li key={a.id}>
                  {fullDate(a.changed_at)} — <b>{user?.nickname ?? "?"}</b>:{" "}
                  {a.old_role ? ROLE_LABEL[a.old_role] : "신규"} → {ROLE_LABEL[a.new_role]}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
