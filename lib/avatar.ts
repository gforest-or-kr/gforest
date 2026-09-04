import "server-only";
import { publicMediaUrl } from "@/lib/storage";

// 아바타 storage 경로 → 공개 URL (S3 "avatars/<path>", CloudFront가 있으면 정적 URL). 서버 전용 —
// 클라 컴포넌트는 서버 부모가 풀어 준 URL을 prop으로 받는다.
// 경로는 {uid}/{timestamp}.{ext} (업로드마다 유니크 → 캐시 무효화 자동).
export async function avatarUrl(path: string | null | undefined): Promise<string | null> {
  return publicMediaUrl("avatars", path);
}
