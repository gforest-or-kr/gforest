import { createClient } from "@/lib/supabase/server";
import { createSlide, updateSlide, deleteSlide } from "./actions";

// SCR-602 메인 슬라이더 관리 — admin 전용(차단은 admin 레이아웃 + RLS/Storage 정책)
export default async function AdminSlidesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("slides")
    .select("id, title, subtitle, link_url, image_desktop_path, is_active, sort_order")
    .order("sort_order");
  const slides = data ?? [];

  const input = "border border-slate-200 rounded-xl text-sm px-3 py-2 bg-white";

  return (
    <main className="pb-16">
      <section className="mt-6">
        <h2 className="font-bold mb-1">
          슬라이드 <span className="text-slate-400 font-normal text-sm">{slides.length}개</span>
        </h2>
        <p className="text-xs text-slate-400 mb-3">
          활성 슬라이드가 1개 이상이면 메인 히어로가 슬라이더로, 0개면 기본 화면으로 표시됩니다.
        </p>

        {slides.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400 rounded-2xl bg-slate-50">
            등록된 슬라이드가 없습니다 — 아래에서 추가하세요
          </p>
        ) : (
          <div className="overflow-x-auto">
            <ul className="divide-y divide-slate-100 min-w-[640px]">
              {slides.map((s) => {
                const update = updateSlide.bind(null, s.id);
                const del = deleteSlide.bind(null, s.id);
                const thumb = supabase.storage
                  .from("site")
                  .getPublicUrl(s.image_desktop_path).data.publicUrl;
                return (
                  <li key={s.id} className="flex items-center gap-3 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt={s.title}
                      className="w-28 h-12 object-cover rounded-lg bg-slate-100 shrink-0"
                    />
                    <form action={update} className="flex flex-wrap items-center gap-2 grow">
                      <input
                        name="title"
                        defaultValue={s.title}
                        required
                        placeholder="제목"
                        className={`${input} w-36`}
                      />
                      <input
                        name="subtitle"
                        defaultValue={s.subtitle ?? ""}
                        placeholder="부제"
                        className={`${input} w-36`}
                      />
                      <input
                        name="link_url"
                        defaultValue={s.link_url ?? ""}
                        placeholder="링크 URL"
                        className={`${input} w-44`}
                      />
                      <input
                        name="sort_order"
                        type="number"
                        defaultValue={s.sort_order}
                        title="정렬 순서"
                        className={`${input} w-20`}
                      />
                      <label className="flex items-center gap-1.5 text-sm px-1">
                        <input
                          name="is_active"
                          type="checkbox"
                          defaultChecked={s.is_active}
                          className="w-4 h-4"
                        />
                        활성
                      </label>
                      <button className="bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-3.5 py-2 rounded-xl">
                        저장
                      </button>
                    </form>
                    <form action={del}>
                      <button className="text-red-500 hover:bg-red-50 text-sm font-medium px-3 py-2 rounded-xl">
                        삭제
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-bold mb-3">새 슬라이드 등록</h2>
        <form
          action={createSlide}
          className="grid gap-3 max-w-xl rounded-2xl border border-slate-100 p-5"
        >
          <label className="grid gap-1 text-sm">
            제목 *
            <input name="title" required placeholder="제목" className={input} />
          </label>
          <label className="grid gap-1 text-sm">
            부제
            <input name="subtitle" placeholder="부제 (선택)" className={input} />
          </label>
          <label className="grid gap-1 text-sm">
            링크 URL
            <input name="link_url" placeholder="https:// 또는 /intro/about (선택)" className={input} />
          </label>
          <label className="grid gap-1 text-sm">
            정렬 순서
            <input name="sort_order" type="number" defaultValue={0} className={input} />
          </label>
          <label className="grid gap-1 text-sm">
            데스크탑 이미지 * <span className="text-xs text-slate-400">권장 1200×450, 2MB 이하</span>
            <input
              name="image_desktop"
              type="file"
              accept="image/*"
              required
              className="text-sm"
            />
          </label>
          <label className="grid gap-1 text-sm">
            모바일 이미지 * <span className="text-xs text-slate-400">권장 750×420, 2MB 이하</span>
            <input
              name="image_mobile"
              type="file"
              accept="image/*"
              required
              className="text-sm"
            />
          </label>
          <button className="bg-forest-600 hover:bg-forest-700 text-white font-medium px-4 py-2.5 rounded-xl w-fit">
            등록
          </button>
        </form>
      </section>
    </main>
  );
}
