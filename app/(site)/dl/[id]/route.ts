import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 첨부 다운로드 프록시 — 만료되는 서명 URL을 글 HTML에 박지 않기 위함.
// 글 본문(특히 공개글 정적 캐시)에는 /dl/{id} 영구 링크만 두고, 클릭 시 세션(RLS)으로
// 권한을 확인해 그 자리에서 새 서명 URL을 만들어 302 리다이렉트한다.
// 권한은 attachments_select(테이블) + attachments_read(스토리지) RLS가 can_read_board로 강제.
// ?inline=1 이면 다운로드 강제 없이(이미지 인라인 표시용), 아니면 원본 파일명으로 다운로드.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  const supabase = await createClient();

  const { data: att } = await supabase
    .from("attachments")
    .select("storage_path, file_name")
    .eq("id", id)
    .single();
  if (!att) return new NextResponse("권한이 없거나 존재하지 않는 파일입니다.", { status: 404 });

  const { data: signed } = await supabase.storage
    .from("attachments")
    .createSignedUrl(att.storage_path, 3600, inline ? undefined : { download: att.file_name });
  if (!signed) return new NextResponse("파일을 가져올 수 없습니다.", { status: 403 });

  return NextResponse.redirect(signed.signedUrl);
}
