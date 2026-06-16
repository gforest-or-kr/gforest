"use client";

import { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { RICH_CLASS } from "@/lib/rich";

function Btn({
  label,
  active,
  on,
}: {
  label: string;
  active?: boolean;
  on: () => void;
}) {
  return (
    <button
      type="button"
      // 버튼 클릭으로 에디터 포커스/선택이 풀리지 않게 mousedown 기본동작 차단
      onMouseDown={(e) => e.preventDefault()}
      onClick={on}
      className={`px-2.5 min-h-[40px] rounded-lg text-sm ${
        active ? "bg-forest-100 text-forest-700 font-semibold" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

// WYSIWYG 에디터 — 출력 HTML을 hidden input(name)에 동기화해 폼 제출에 실린다.
// 저장 시 서버가 sanitizeRichHtml로 정화하므로 클라 출력은 그대로 보내도 안전.
export default function RichEditor({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [html, setHtml] = useState(defaultValue);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
      }),
    ],
    content: defaultValue,
    immediatelyRender: false, // Next SSR 하이드레이션 불일치 방지
    editorProps: {
      attributes: { class: `${RICH_CLASS} min-h-[40vh] outline-none py-3` },
    },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  function setLink() {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL (비우면 해제)", prev ?? "https://");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-0.5 border-y border-slate-100 py-1.5">
        {editor && (
          <>
            <Btn label="굵게" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()} />
            <Btn label="기울임" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()} />
            <Btn label="제목" active={editor.isActive("heading", { level: 2 })} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
            <Btn label="소제목" active={editor.isActive("heading", { level: 3 })} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
            <Btn label="• 목록" active={editor.isActive("bulletList")} on={() => editor.chain().focus().toggleBulletList().run()} />
            <Btn label="1. 목록" active={editor.isActive("orderedList")} on={() => editor.chain().focus().toggleOrderedList().run()} />
            <Btn label="인용" active={editor.isActive("blockquote")} on={() => editor.chain().focus().toggleBlockquote().run()} />
            <Btn label="링크" active={editor.isActive("link")} on={setLink} />
          </>
        )}
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
