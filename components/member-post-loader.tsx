"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { canReadBoard } from "@/lib/menu";
import AccessNotice from "@/components/access-notice";
import PostView, { type PostViewData } from "@/components/post-view";
import type { Database } from "@/lib/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// 권한(회원) 게시판 글 — 페이지는 ISR(쿠키 미사용)로 유지하고, 권한 글 본문만 브라우저 세션
// (RLS)으로 클라에서 가져와 렌더한다. 이렇게 해야 layout/페이지가 정적이라 prefetch가 산다.
type State =
  | { kind: "loading" }
  | { kind: "denied"; loggedIn: boolean }
  | { kind: "notfound" }
  | { kind: "ready"; data: PostViewData };

export default function MemberPostLoader({
  slug,
  postId,
  boardName,
  readRoles,
  writeRoles,
}: {
  slug: string;
  postId: string;
  boardName: string;
  readRoles: AppRole[];
  writeRoles: string[];
}) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const uid = claims?.claims?.sub as string | undefined;

      let role: AppRole | null = null;
      if (uid) {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", uid).single();
        role = p?.role ?? null;
      }
      if (!canReadBoard(readRoles, role)) {
        if (active) setState({ kind: "denied", loggedIn: !!uid });
        return;
      }

      const { data: post } = await supabase
        .from("posts")
        .select("*, author:profiles(id, nickname), boards!inner(slug)")
        .eq("id", postId)
        .eq("boards.slug", slug)
        .is("deleted_at", null)
        .single();
      if (!post) {
        if (active) setState({ kind: "notfound" });
        return;
      }

      const [{ data: comments }, { data: attachments }, { data: prevPost }, { data: nextPost }] =
        await Promise.all([
          supabase
            .from("comments")
            .select("id, content, created_at, parent_id, author:profiles(id, nickname)")
            .eq("post_id", postId)
            .is("deleted_at", null)
            .order("created_at"),
          supabase
            .from("attachments")
            .select("id, file_name, byte_size, storage_path, mime_type")
            .eq("post_id", postId)
            .order("created_at"),
          supabase.from("posts").select("id, title").eq("board_id", post.board_id).is("deleted_at", null)
            .lt("created_at", post.created_at).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("posts").select("id, title").eq("board_id", post.board_id).is("deleted_at", null)
            .gt("created_at", post.created_at).order("created_at").limit(1).maybeSingle(),
        ]);

      const signed = await Promise.all(
        (attachments ?? []).map(async (f) => {
          const { data } = await supabase.storage.from("attachments").createSignedUrl(f.storage_path, 3600);
          return { id: f.id, file_name: f.file_name, byte_size: f.byte_size, mime_type: f.mime_type, url: data?.signedUrl ?? null };
        }),
      );

      if (!active) return;
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
          author: post.author as { id: string; nickname: string } | null,
          attachments: signed,
          comments: (comments ?? []) as PostViewData["comments"],
          prevPost: prevPost ?? null,
          nextPost: nextPost ?? null,
        },
      });
    })();
    return () => {
      active = false;
    };
  }, [slug, postId, boardName, writeRoles, readRoles]);

  if (state.kind === "ready") return <PostView {...state.data} />;
  if (state.kind === "denied")
    return (
      <main className="max-w-3xl mx-auto px-4">
        <AccessNotice boardName={boardName} readRoles={readRoles} loggedIn={state.loggedIn} returnTo={`/boards/${slug}/${postId}`} />
      </main>
    );
  if (state.kind === "notfound")
    return <main className="max-w-3xl mx-auto px-4 py-24 text-center text-slate-400">글을 찾을 수 없습니다.</main>;

  // loading 스켈레톤
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
