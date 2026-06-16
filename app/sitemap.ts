import type { MetadataRoute } from "next";
import { publicClient } from "@/lib/supabase/public";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600; // 1시간마다 재생성

// 공개 페이지만 수록. publicClient(anon)라 RLS상 공개 게시판 글만 읽히고, 추가로 read_roles null
// 필터로 회원 게시판을 이중 배제한다(누설 방지, GFM-58).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const sb = publicClient();
  const [{ data: boards }, { data: pages }, { data: posts }] = await Promise.all([
    sb.from("boards").select("slug").is("read_roles", null).eq("is_active", true),
    sb.from("static_pages").select("slug, updated_at"),
    sb
      .from("posts")
      .select("id, created_at, boards!inner(slug, read_roles)")
      .is("deleted_at", null)
      .is("boards.read_roles", null)
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...(pages ?? []).map((p) => ({
      url: `${SITE_URL}/intro/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "monthly" as const,
    })),
    ...(boards ?? []).map((b) => ({
      url: `${SITE_URL}/boards/${b.slug}`,
      changeFrequency: "daily" as const,
    })),
    ...(posts ?? []).map((p) => ({
      url: `${SITE_URL}/boards/${(p.boards as unknown as { slug: string }).slug}/${p.id}`,
      lastModified: p.created_at as string,
    })),
  ];
}
