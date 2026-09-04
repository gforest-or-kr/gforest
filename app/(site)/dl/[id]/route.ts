import { type NextRequest, NextResponse } from "next/server";
import { withUser, one } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { presignGet } from "@/lib/storage";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 첨부 다운로드 프록시 — 만료되는 서명 URL을 글 HTML에 박지 않기 위함.
// 글 본문에는 /dl/{id} 영구 링크만 두고, 클릭 시 세션(RLS)으로 권한을 확인해 그 자리에서
// S3 presigned GET(1h)을 만들어 302 리다이렉트한다. 권한은 attachments_select RLS가 can_read_board로 강제.
// ?inline=1 이면 다운로드 강제 없이(이미지 인라인 표시용), 아니면 원본 파일명으로 다운로드.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inline = req.nextUrl.searchParams.get("inline") === "1";
  if (!UUID_RE.test(id)) return new NextResponse("권한이 없거나 존재하지 않는 파일입니다.", { status: 404 });

  const userId = await getSessionUserId();
  const att = await withUser(userId, (c) =>
    one<{ storage_path: string; file_name: string }>(
      c,
      "select storage_path, file_name from attachments where id = $1",
      [id],
    ),
  );
  if (!att) return new NextResponse("권한이 없거나 존재하지 않는 파일입니다.", { status: 404 });

  let url: string;
  try {
    url = await presignGet("attachments", att.storage_path, inline ? {} : { downloadName: att.file_name });
  } catch {
    return new NextResponse("파일을 가져올 수 없습니다.", { status: 403 });
  }

  return NextResponse.redirect(url);
}
