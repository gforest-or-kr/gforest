import { createClient } from "@/lib/supabase/server";
import { createPopup, updatePopup, deletePopup } from "./actions";

// timestamptz(UTC) → datetime-local(KST 벽시계 "YYYY-MM-DDTHH:mm"). actions.localToIso의 역변환.
function isoToLocal(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 16);
}

// SCR-110 메인 레이어 팝업 관리 — admin 전용(차단은 admin 레이아웃 + popups_admin RLS)
export default async function AdminPopupsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("popups")
    .select("id, title, body, link_url, dismiss_days, sort_order, is_active, starts_at, ends_at")
    .order("sort_order");
  const popups = data ?? [];

  const input = "border border-slate-200 rounded-xl text-sm px-3 py-2 bg-white";

  return (
    <main className="pb-16">
      <section className="mt-6">
        <h2 className="font-bold mb-1">
          팝업 <span className="text-slate-400 font-normal text-sm">{popups.length}개</span>
        </h2>
        <p className="text-xs text-slate-400 mb-3">
          활성이며 노출 기간(시작~종료) 안에 있는 팝업만 메인에 표시됩니다. 시간은 한국시간(KST) 기준입니다.
        </p>

        {popups.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400 rounded-2xl bg-slate-50">
            등록된 팝업이 없습니다 — 아래에서 추가하세요
          </p>
        ) : (
          <ul className="grid gap-4">
            {popups.map((p) => {
              const update = updatePopup.bind(null, p.id);
              const del = deletePopup.bind(null, p.id);
              return (
                <li key={p.id} className="rounded-2xl border border-slate-100 p-4">
                  <form action={update} className="grid gap-2">
                    <div className="flex flex-wrap gap-2">
                      <input
                        name="title"
                        defaultValue={p.title}
                        required
                        placeholder="제목"
                        className={`${input} grow min-w-48`}
                      />
                      <input
                        name="link_url"
                        defaultValue={p.link_url ?? ""}
                        placeholder="링크 URL (선택)"
                        className={`${input} grow min-w-48`}
                      />
                    </div>
                    <textarea
                      name="body"
                      defaultValue={p.body}
                      placeholder="본문"
                      rows={2}
                      className={`${input} resize-y`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="grid gap-0.5 text-xs text-slate-500">
                        노출 시작 (KST)
                        <input
                          name="starts_at"
                          type="datetime-local"
                          defaultValue={isoToLocal(p.starts_at)}
                          className={input}
                        />
                      </label>
                      <label className="grid gap-0.5 text-xs text-slate-500">
                        노출 종료 (KST)
                        <input
                          name="ends_at"
                          type="datetime-local"
                          required
                          defaultValue={isoToLocal(p.ends_at)}
                          className={input}
                        />
                      </label>
                      <label className="grid gap-0.5 text-xs text-slate-500">
                        다시보지않기(일)
                        <input
                          name="dismiss_days"
                          type="number"
                          min={1}
                          max={30}
                          defaultValue={p.dismiss_days}
                          className={`${input} w-24`}
                        />
                      </label>
                      <label className="grid gap-0.5 text-xs text-slate-500">
                        정렬 순서
                        <input
                          name="sort_order"
                          type="number"
                          defaultValue={p.sort_order}
                          className={`${input} w-20`}
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-sm px-1 self-end pb-2">
                        <input
                          name="is_active"
                          type="checkbox"
                          defaultChecked={p.is_active}
                          className="w-4 h-4"
                        />
                        활성
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl">
                        저장
                      </button>
                      <button
                        formAction={del}
                        formNoValidate
                        className="text-red-500 hover:bg-red-50 text-sm font-medium px-3 py-2 rounded-xl"
                      >
                        삭제
                      </button>
                    </div>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-bold mb-3">새 팝업 등록</h2>
        <form
          action={createPopup}
          className="grid gap-3 max-w-xl rounded-2xl border border-slate-100 p-5"
        >
          <label className="grid gap-1 text-sm">
            제목 *
            <input name="title" required placeholder="제목" className={input} />
          </label>
          <label className="grid gap-1 text-sm">
            본문
            <textarea name="body" rows={3} placeholder="본문 (선택)" className={`${input} resize-y`} />
          </label>
          <label className="grid gap-1 text-sm">
            링크 URL
            <input name="link_url" placeholder="https:// 또는 /notice/123 (선택)" className={input} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              노출 시작 (KST)
              <input name="starts_at" type="datetime-local" className={input} />
            </label>
            <label className="grid gap-1 text-sm">
              노출 종료 (KST) *
              <input name="ends_at" type="datetime-local" required className={input} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              다시보지않기 (일, 1–30)
              <input name="dismiss_days" type="number" min={1} max={30} defaultValue={3} className={input} />
            </label>
            <label className="grid gap-1 text-sm">
              정렬 순서
              <input name="sort_order" type="number" defaultValue={0} className={input} />
            </label>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input name="is_active" type="checkbox" defaultChecked className="w-4 h-4" />
            활성
          </label>
          <button className="bg-forest-600 hover:bg-forest-700 text-white font-medium px-4 py-2.5 rounded-xl w-fit">
            등록
          </button>
        </form>
        <p className="text-xs text-slate-400 mt-2">
          노출 시작을 비우면 등록 즉시부터 노출됩니다. 노출 종료는 필수입니다.
        </p>
      </section>
    </main>
  );
}
