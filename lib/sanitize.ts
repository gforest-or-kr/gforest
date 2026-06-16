import sanitizeHtml from "sanitize-html";

// WYSIWYG 본문 정화 — 저장 시점에 서버에서 실행해 저장형 XSS를 차단한다(GFM-61).
// Tiptap StarterKit + Link가 만드는 태그만 허용. script·on*·iframe·style·class 전부 제거.
// 링크는 http/https/mailto만, rel/target 강제. 렌더(dangerouslySetInnerHTML)는 이 결과만 받는다.
const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "s", "del", "u",
  "h2", "h3", "ul", "ol", "li", "blockquote", "code", "pre", "a", "hr",
];

export function sanitizeRichHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: "a",
        attribs: { ...attribs, rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
    },
  });
}

// 태그를 걷어낸 실제 텍스트가 비었는지 — 빈 에디터(`<p></p>`) 제출 거르기
export function htmlIsEmpty(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, "")
      .length === 0
  );
}
