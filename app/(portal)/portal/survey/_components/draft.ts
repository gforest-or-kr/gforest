import type { DraftV1 } from "@/lib/survey/types";

// 질의서 임시 저장(이 기기의 localStorage). 서버로는 보내지 않는다.
// 사파리 프라이빗 모드·저장소 차단에서는 localStorage 접근 자체가 throw 하므로 모든 접근을 감싼다 — 실패해도 폼은 동작.
// 모듈 로드 시점에는 아무것도 읽지 않는다(서버 렌더에서도 import 된다).

// 설문(slug)마다 다른 키 — 한 설문의 작성 중 내용이 다른 설문에 나타나지 않게.
export function draftKey(slug: string): string {
  return `gforest:survey:${slug}:draft:v1`;
}
// readDraftRaw 의 "저장소를 쓸 수 없음" 표시. JSON 이 NUL 로 시작할 수 없어 실제 저장본과 겹치지 않는다.
export const DRAFT_UNAVAILABLE = "\u0000unavailable";

export type DraftFields = Omit<DraftV1, "v" | "savedAt">;

// useSyncExternalStore 용 구독 — 다른 곳에서 바뀔 일이 없어 아무것도 듣지 않는다(마운트 때 한 번 읽기)
export function subscribeDraft(): () => void {
  return () => {};
}

// 클라이언트 스냅샷: 없으면 "", 저장소를 못 쓰면 DRAFT_UNAVAILABLE. 절대 throw 하지 않는다.
export function readDraftRaw(slug: string): string {
  try {
    return window.localStorage.getItem(draftKey(slug)) ?? "";
  } catch {
    return DRAFT_UNAVAILABLE;
  }
}

export function writeDraft(slug: string, d: DraftFields): boolean {
  try {
    const value: DraftV1 = {
      v: 1,
      savedAt: new Date().toISOString(),
      page: d.page,
      roles: d.roles,
      roleOther: d.roleOther,
      answers: d.answers,
    };
    window.localStorage.setItem(draftKey(slug), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(slug: string): void {
  try {
    window.localStorage.removeItem(draftKey(slug));
  } catch {
    // 지우지 못해도 제출은 이미 끝났다 — 다음 방문에서 이전 내용이 다시 보일 뿐
  }
}
