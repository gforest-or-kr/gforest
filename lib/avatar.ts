// 아바타 storage 경로 → 공개 URL. avatars 버킷이 public이라 서명 없이 바로 접근한다.
// 경로는 {uid}/{timestamp}.{ext} (업로드마다 유니크 → 캐시 무효화 자동).
export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
}
