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
// 순차 워터폴 profile→post→나머지→서명URL 을 제거). 서명 URL도 안 만든다 — 첨부는 /dl/{id}
// 프록시 링크라 클릭 시 권한확인+서명한다. 이전/다음 글만 created_at에 의존해 본문 후 비차단으로 채움.
type State =
  | { kind: "loading" }
  | { kind: "denied"; loggedIn: boolean }
  | { kind: "notfound" }
  | { kind: "ready"; data: PostViewData };

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
            .select("id, content, created_at, parent_id, author:profiles(id, nickname)")
            .eq("post_id", postId)
            .is("deleted_at", null)
            .order("created_at"),
          supabase
            .from("attachments")
            .select("id, file_name, byte_size, mime_type")
            .eq("post_id", postId)
            .order("created_at"),
        ]);
      if (!active) return;

      const role = (prof?.role ?? null) as AppRole | null;
      if (!canReadBoard(readRoles, role)) {
        setState({ kind: "denied", loggedIn: true });
        return;
      }
      if (!post) {
        setState({ kind: "notfound" });
        return;
      }

      setState({
        kind: "ready",
        data: {
          slug,
          boardName,
          writeRoles,
          post: {
            id: post.id, title: post.title, content: post.content, view_count: post.view_count,
            created_at: post.created_at, event_date: post.event_date, legacy_document_srl: post.legacy_document_srl,
          },
          author: post.author as PostViewData["author"],
          attachments: (attachments ?? []) as PostViewData["attachments"],
          comments: (comments ?? []) as PostViewData["comments"],
          prevPost: null,
          nextPost: null,
        },
      });

      // 이전/다음 글은 글의 created_at에 의존 → 본문 렌더 후 비차단 2번째 왕복으로 채운다
      const [{ data: prevPost }, { data: nextPost }] = await Promise.all([
        supabase.from("posts").select("id, title").eq("board_id", boardId).is("deleted_at", null)
          .lt("created_at", post.created_at).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("posts").select("id, title").eq("board_id", boardId).is("deleted_at", null)
          .gt("created_at", post.created_at).order("created_at").limit(1).maybeSingle(),
      ]);
      if (active) setNav({ prevPost: prevPost ?? null, nextPost: nextPost ?? null });
    })();
    return () => {
      active = false;
    };
  }, [slug, postId, boardId, boardName, writeRoles, readRoles]);

  if (state.kind === "ready")
    return <PostView {...state.data} prevPost={nav.prevPost} nextPost={nav.nextPost} />;

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
