"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canReadBoard } from "@/lib/menu";
import AccessNotice from "@/components/access-notice";
import PostView, { type PostViewData } from "@/components/post-view";
import type { Database } from "@/lib/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Nav = { id: string; title: string } | null;

// 권한(회원) 게시판 글 본문 — 페이지는 정적(●)으로 두고, 본문만 브라우저 세션(RLS)으로 가져온다.
// 핵심: 단일 왕복. 역할·글·댓글·첨부는 서로 의존이 없어 한 번에 병렬 요청한다(GFM-46의 4단
// 순차 워터폴 profile→post→나머지→서명URL 을 제거). 이전/다음 글과 인라인 이미지 서명 URL은
// 1차 결과(created_at·storage_path)에 의존하므로 본문 렌더 후 비차단 2차 왕복에서 병렬로 채운다.
// 인라인 이미지는 배치 서명 URL 직링크로 렌더한다(GFM-64) — 이 경로는 클라 fetch라 정적 HTML에
// 서명 URL이 동결될 일이 없고, 이미지당 /dl 함수 호출+302 왕복이 사라진다. 다운로드 <a>는
// 원본 파일명 disposition·영구 링크가 필요하므로 /dl/{id} 프록시를 유지한다.
// 재방문은 세션 메모리 캐시로 즉시 표시하고 같은 fetch가 백그라운드 재검증이 된다(GFM-68).
type State =
  | { kind: "loading" }
  | { kind: "denied"; loggedIn: boolean }
  | { kind: "notfound" }
  | { kind: "ready"; data: PostViewData };

// 세션 메모리 캐시(GFM-68) — 목록↔글 왕복(지배적 사용 패턴) 재방문 시 스켈레톤 없이 즉시
// 표시하고, 기존 fetch 흐름이 그대로 백그라운드 재검증이 되어 최신으로 교체한다(SWR, 무의존성).
// 키에 uid를 포함해 같은 브라우저 세션에서 계정이 바뀌어도 타인의 캐시가 노출되지 않는다.
// 페이지 새로고침이면 모듈째 초기화되는 휘발성 캐시라 무효화 로직이 따로 필요 없다.
type CacheEntry = {
  data: PostViewData;
  nav: { prevPost: Nav; nextPost: Nav };
  imageUrls?: Record<string, string>;
};
const sessionCache = new Map<string, CacheEntry>();
const CACHE_MAX = 30;

export default function MemberPostLoader({
  slug,
  postId,
  boardId,
  boardName,
  readRoles,
  writeRoles,
}: {
  slug: string;
  postId: string;
  boardId: string;
  boardName: string;
  readRoles: AppRole[];
  writeRoles: string[];
}) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [nav, setNav] = useState<{ prevPost: Nav; nextPost: Nav }>({ prevPost: null, nextPost: null });
  // "loading"=서명 대기(placeholder), 객체=서명 URL 직링크, undefined=/dl 폴백
  const [imageUrls, setImageUrls] = useState<Record<string, string> | "loading" | undefined>();

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims(); // 로컬 JWT 검증 — 네트워크 0
      const uid = claims?.claims?.sub as string | undefined;

      // 비로그인은 즉시 권한 안내 — 네트워크 왕복 없음
      if (!uid) {
        if (active) setState({ kind: "denied", loggedIn: false });
        return;
      }

      // 캐시 적중 시 즉시 렌더 — 아래 fetch는 그대로 진행되어 백그라운드 재검증이 된다
      const cacheKey = `${uid}:${postId}`;
      const cached = sessionCache.get(cacheKey);
      if (cached) {
        setState({ kind: "ready", data: cached.data });
        setNav(cached.nav);
        setImageUrls(cached.imageUrls);
      }

      // 단일 왕복: 역할·글·댓글·첨부를 한 번에 병렬 요청(서로 의존 없음, postId는 URL에서 이미 앎)
      const [{ data: prof }, { data: post }, { data: comments }, { data: attachments }] =
        await Promise.all([
          supabase.from("profiles").select("role").eq("id", uid).maybeSingle(),
          supabase
            .from("posts")
            .select("*, author:profiles(id, nickname), boards!inner(slug)")
            .eq("id", postId)
            .eq("boards.slug", slug)
            .is("deleted_at", null)
            .maybeSingle(),
          supabase
            .from("comments")
            .select("id, content, created_at, edited_at, parent_id, author:profiles(id, nickname)")
            .eq("post_id", postId)
            .is("deleted_at", null)
            .order("created_at"),
          supabase
            .from("attachments")
            .select("id, file_name, byte_size, mime_type, storage_path")
            .eq("post_id", postId)
            .order("created_at"),
        ]);
      if (!active) return;

      const role = (prof?.role ?? null) as AppRole | null;
      if (!canReadBoard(readRoles, role)) {
        sessionCache.delete(cacheKey); // 재검증에서 권한 상실 확인 — 캐시도 함께 무효화
        setState({ kind: "denied", loggedIn: true });
        return;
      }
      if (!post) {
        sessionCache.delete(cacheKey);
        setState({ kind: "notfound" });
        return;
      }

      const data: PostViewData = {
        slug,
        boardName,
        writeRoles,
        post: {
          id: post.id, title: post.title, content: post.content, view_count: post.view_count,
          created_at: post.created_at, event_date: post.event_date, legacy_document_srl: post.legacy_document_srl,
          content_html: post.content_html,
        },
        author: post.author as PostViewData["author"],
        attachments: (attachments ?? []) as PostViewData["attachments"],
        comments: (comments ?? []) as PostViewData["comments"],
        prevPost: null,
        nextPost: null,
      };
      setState({ kind: "ready", data });

      // 캐시 저장 — entry 참조를 아래 2차 왕복이 이어서 채운다. 재삽입으로 최신을 뒤로 보내
      // 상한 초과 시 가장 오래된 항목부터 밀려나게 한다(간이 LRU).
      const entry: CacheEntry = { data, nav: { prevPost: null, nextPost: null }, imageUrls: cached?.imageUrls };
      sessionCache.delete(cacheKey);
      sessionCache.set(cacheKey, entry);
      if (sessionCache.size > CACHE_MAX) sessionCache.delete(sessionCache.keys().next().value!);

      // 인라인으로 보여줄 이미지 첨부 — 서명 URL이 오기 전까지 placeholder 렌더.
      // 단, 캐시된 서명 URL을 이미 그렸다면 placeholder로 되돌리지 않는다(새 URL 도착 시 교체).
      const imageAtts = (attachments ?? []).filter((a) => a.mime_type?.startsWith("image/"));
      if (imageAtts.length > 0 && !cached?.imageUrls) setImageUrls("loading");

      // 이전/다음 글(created_at 의존)·이미지 배치 서명(storage_path 의존)은
      // 본문 렌더 후 비차단 2번째 왕복에서 병렬로 채운다
      const [{ data: prevPost }, { data: nextPost }, signed] = await Promise.all([
        supabase.from("posts").select("id, title").eq("board_id", boardId).is("deleted_at", null)
          .lt("created_at", post.created_at).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("posts").select("id, title").eq("board_id", boardId).is("deleted_at", null)
          .gt("created_at", post.created_at).order("created_at").limit(1).maybeSingle(),
        imageAtts.length > 0
          ? supabase.storage.from("attachments").createSignedUrls(imageAtts.map((a) => a.storage_path), 3600)
          : Promise.resolve(null),
      ]);
      const newNav = { prevPost: prevPost ?? null, nextPost: nextPost ?? null };
      entry.nav = newNav; // 언마운트 후 완료돼도 캐시는 갱신(다음 방문이 최신을 받음)
      let newImageUrls = entry.imageUrls;
      if (imageAtts.length > 0) {
        const byPath = new Map((signed?.data ?? []).map((s) => [s.path, s.signedUrl]));
        const map: Record<string, string> = {};
        for (const a of imageAtts) {
          const url = byPath.get(a.storage_path);
          if (url) map[a.id] = url;
        }
        // 서명 전면 실패 시 undefined → PostView가 /dl 프록시로 폴백(자가 복구)
        newImageUrls = Object.keys(map).length > 0 ? map : undefined;
        entry.imageUrls = newImageUrls;
      }
      if (!active) return;
      setNav(newNav);
      if (imageAtts.length > 0) setImageUrls(newImageUrls);
    })();
    return () => {
      active = false;
    };
  }, [slug, postId, boardId, boardName, writeRoles, readRoles]);

  if (state.kind === "ready")
    return <PostView {...state.data} prevPost={nav.prevPost} nextPost={nav.nextPost} imageUrls={imageUrls} />;

  if (state.kind === "denied")
    return (
      <main className="max-w-3xl mx-auto px-4">
        <AccessNotice
          boardName={boardName}
          readRoles={readRoles}
          loggedIn={state.loggedIn}
          returnTo={`/boards/${slug}/${postId}`}
        />
      </main>
    );

  if (state.kind === "notfound")
    return (
      <main className="max-w-3xl mx-auto px-4 py-24 text-center text-slate-400">
        글을 찾을 수 없습니다.
      </main>
    );

  // loading — 스켈레톤(정적 셸이 prefetch로 즉시 뜨고, 그 위에서 1왕복으로 본문이 도착)
  return (
    <main className="max-w-3xl mx-auto px-4 pb-24 animate-pulse">
      <div className="mt-6 mb-4 h-4 w-24 rounded bg-slate-100" />
      <div className="h-7 w-3/4 rounded bg-slate-100" />
      <div className="mt-3 h-3.5 w-48 rounded bg-slate-50" />
      <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 rounded bg-slate-50" style={{ width: `${95 - (i % 3) * 15}%` }} />
        ))}
      </div>
    </main>
  );
}
