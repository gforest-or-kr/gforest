import type { MetadataRoute } from "next";
import { unstable_cache } from "next/cache";
import { withUser, many } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

// 빌드 시점에 DB에 접근하지 않도록 동적 라우트로 두고, 결과는 unstable_cache로 1시간 캐시한다.
export const dynamic = "force-dynamic";

// 공개 페이지만 수록. anon RLS 컨텍스트(withUser(null))라 공개 게시판 글만 읽히고, 추가로
// read_roles null 필터로 회원 게시판을 이중 배제한다(누설 방지, GFM-58).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getSitemap();
}

const getSitemap = unstable_cache(async (): Promise<MetadataRoute.Sitemap> => {
  const { boards, pages, posts } = await withUser(null, async (c) => {
    const boards = await many<{ slug: string }>(
      c,
      "select slug from boards where read_roles is null and is_active = true",
    );
    const pages = await many<{ slug: string; updated_at: string }>(
      c,
      "select slug, to_json(updated_at)#>>'{}' as updated_at from static_pages",
    );
    const posts = await many<{ id: string; created_at: string; slug: string }>(
      c,
      `select p.id, to_json(p.created_at)#>>'{}' as created_at, b.slug
       from posts p join boards b on b.id = p.board_id
       where p.deleted_at is null and b.read_roles is null
       order by p.created_at desc limit 2000`,
    );
    return { boards, pages, posts };
  });

  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    ...pages.map((p) => ({
      url: `${SITE_URL}/intro/${p.slug}`,
      lastModified: p.updated_at,
      changeFrequency: "monthly" as const,
    })),
    ...boards.map((b) => ({
      url: `${SITE_URL}/boards/${b.slug}`,
      changeFrequency: "daily" as const,
    })),
    ...posts.map((p) => ({
      url: `${SITE_URL}/boards/${p.slug}/${p.id}`,
      lastModified: p.created_at,
    })),
  ];
}, ["sitemap"], { revalidate: 3600, tags: ["menu"] });
