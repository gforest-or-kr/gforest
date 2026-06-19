import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// SCR-200 정적 페이지 — D: 좌측 서브메뉴 / M: 가로 스크롤 칩
export const revalidate = 600; // 콘텐츠 변경이 드물어 10분 ISR

export default async function IntroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const [{ data: page }, { data: siblings }] = await Promise.all([
    supabase.from("static_pages").select("*").eq("slug", slug).single(),
    supabase
      .from("static_pages")
      .select("slug, title, sort_order")
      .order("sort_order"),
  ]);
  if (!page) notFound();

  const menu = siblings ?? [];

  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      {/* M: 가로 스크롤 칩 */}
      <nav className="lg:hidden mt-4 -mx-4 px-4 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
        {menu.map((m) => (
          <Link
            key={m.slug}
            href={`/intro/${m.slug}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border ${
              m.slug === slug
                ? "bg-forest-600 border-forest-600 text-white"
                : "border-slate-200 text-slate-600"
            }`}
          >
            {m.title}
          </Link>
        ))}
      </nav>

      <div className="lg:flex lg:gap-10 mt-4 lg:mt-8">
        {/* D: 좌측 서브메뉴 */}
        <aside className="hidden lg:block w-56 shrink-0">
          <p className="text-xs font-semibold text-slate-400 mb-2 px-3">학교소개</p>
          <nav className="space-y-0.5">
            {menu.map((m) => (
              <Link
                key={m.slug}
                href={`/intro/${m.slug}`}
                className={`block rounded-xl px-3 py-2.5 text-sm ${
                  m.slug === slug
                    ? "bg-forest-50 text-forest-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{page.title}</h1>
          {page.content ? (
            <div
              // 고정폭 래퍼·표·이미지가 모바일 폭을 넘지 않도록 모든 자손을 컨테이너 폭으로 제한
              className="mt-6 leading-relaxed [&_*]:max-w-full [&_img]:h-auto [&_table]:block [&_table]:overflow-x-auto whitespace-pre-wrap break-words"
              // XE 이관 콘텐츠는 정제된 HTML — ETL에서 sanitize 후 저장
              dangerouslySetInnerHTML={{ __html: page.content }}
            />
          ) : (
            <p className="mt-10 text-sm text-slate-400">
              콘텐츠 준비 중입니다. (기존 사이트에서 이관 예정)
            </p>
          )}
        </article>
      </div>
    </main>
  );
}
