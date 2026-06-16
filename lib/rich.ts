// WYSIWYG 본문 표시·편집 공용 타이포그래피 클래스.
// 별도 lib에 둬 PostView(읽기 경로)가 RichEditor(Tiptap·client)를 import하지 않게 한다
// — 그래야 공개 글 정적 렌더 경로에 에디터 번들이 끌려오지 않는다.
export const RICH_CLASS =
  "leading-relaxed break-words [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h3]:font-semibold [&_h3]:mt-3 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 [&_a]:text-forest-700 [&_a]:underline [&_pre]:bg-slate-50 [&_pre]:rounded-xl [&_pre]:p-3 [&_pre]:text-sm [&_pre]:overflow-x-auto";
