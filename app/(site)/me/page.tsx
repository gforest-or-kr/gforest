import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/menu";
import { shortDate } from "@/lib/format";
import ProfileEditForm from "@/components/profile-edit-form";

export const dynamic = "force-dynamic";

// SCR-410 마이페이지 (1차: 프로필 + 내가 쓴 글)
export default async function MePage() {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?returnTo=/me");

  const supabase = await createClient();
  const { data: myPosts } = await supabase
    .from("posts")
    .select("id, title, created_at, boards(slug, name)")
    .eq("author_id", profile.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main className="max-w-3xl mx-auto px-4 pb-16">
      <div className="mt-8 mb-3 flex items-center gap-2">
        <h1 className="font-bold text-lg">내 정보</h1>
        <span className="text-[11px] font-semibold bg-forest-50 text-forest-700 border border-forest-200 rounded-full px-2 py-0.5">
          {ROLE_LABEL[profile.role]}
        </span>
      </div>
      <ProfileEditForm
        profile={{
          id: profile.id,
          nickname: profile.nickname,
          name: profile.name,
          avatar_path: profile.avatar_path,
        }}
      />

      {profile.role === "pending" && (
        <p className="mt-4 rounded-2xl bg-amber-50 text-amber-800 text-sm px-4 py-3 leading-relaxed">
          운영진 승인 대기 중입니다. 승인이 완료되면 회원 게시판을 이용할 수
          있어요.
        </p>
      )}

      <section className="mt-8">
        <h2 className="font-bold text-lg mb-3">내가 쓴 글</h2>
        {(myPosts ?? []).length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">아직 작성한 글이 없습니다</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {(myPosts ?? []).map((p) => {
              const board = p.boards as { slug: string; name: string } | null;
              return (
                <li key={p.id} className="py-3 flex justify-between gap-3 text-sm">
                  <Link
                    href={`/boards/${board?.slug}/${p.id}`}
                    className="truncate hover:text-forest-700"
                  >
                    <span className="text-forest-600 font-medium mr-2">{board?.name}</span>
                    {p.title}
                  </Link>
                  <span className="text-xs text-slate-400 shrink-0">{shortDate(p.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
