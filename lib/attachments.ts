// 첨부파일 공용 상수·검증 — 클라이언트(attachment-field)와 서버 액션(createPost) 양쪽에서 동일 함수 사용
// 권한(업로드/행 삽입)은 storage 정책과 attachments_insert RLS가 강제한다 (CLAUDE.md 원칙 3). 여기선 형식 검증만.

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 버킷 file_size_limit(10MB)와 동일
export const MAX_FILE_COUNT = 10;

// 실행파일 차단 블록리스트 (확장자 소문자 비교)
export const BLOCKED_EXTENSIONS = [
  "exe", "dll", "msi", "bat", "cmd", "com", "scr", "ps1",
  "vbs", "js", "jar", "sh", "php", "jsp", "apk", "app",
];

// 업로드 완료 파일 메타데이터 — 폼 hidden input(JSON)으로 서버 액션에 전달
export type AttachmentMeta = {
  storage_path: string;
  file_name: string;
  byte_size: number;
  mime_type: string;
};

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : "";
}

// 확장자·크기 검증. 통과 시 null, 실패 시 사유 문자열 반환.
export function validateFile(name: string, size: number): string | null {
  if (BLOCKED_EXTENSIONS.includes(extensionOf(name))) {
    return "실행파일은 첨부할 수 없습니다";
  }
  if (size > MAX_FILE_SIZE) {
    return "10MB를 초과하는 파일은 첨부할 수 없습니다";
  }
  return null;
}
