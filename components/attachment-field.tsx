"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_FILE_COUNT,
  validateFile,
  type AttachmentMeta,
} from "@/lib/attachments";

// 클라이언트 리사이즈 대상 포맷 (gif는 애니메이션 보존 위해 제외)
const RESIZABLE = ["image/jpeg", "image/png", "image/webp"];
const MAX_EDGE = 1600;

// 장변 1600px 초과 이미지를 canvas로 축소 후 같은 포맷으로 재인코딩. 대상 아님/실패 시 원본 반환.
async function maybeResize(file: File): Promise<File> {
  if (!RESIZABLE.includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    if (Math.max(width, height) <= MAX_EDGE) {
      bitmap.close();
      return file;
    }
    const scale = MAX_EDGE / Math.max(width, height);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type),
    );
    if (!blob) return file;
    return new File([blob], file.name, { type: file.type });
  } catch {
    return file; // 리사이즈 실패 시 원본 업로드
  }
}

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "bin";
}

type ExistingAttachment = {
  id: string;
  file_name: string;
  byte_size: number;
  mime_type: string | null;
};

export default function AttachmentField({
  initial = [],
}: {
  initial?: ExistingAttachment[];
}) {
  const [items, setItems] = useState<AttachmentMeta[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // 수정 시 기존 첨부 = initial − 제거표시. 새 업로드(items)와 합쳐 최대 개수를 센다.
  const existing = initial.filter((a) => !removedIds.includes(a.id));

  // 기존 첨부 제거는 스토리지를 건드리지 않고 표시만 — 실제 삭제는 저장(updatePost) 시점.
  // (수정 취소 시 파일이 보존돼야 하므로 새 업로드와 달리 즉시 삭제하지 않는다)
  function removeExisting(id: string) {
    setRemovedIds((prev) => [...prev, id]);
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = ""; // 같은 파일 재선택 허용
    if (files.length === 0) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrors(["로그인이 필요합니다"]);
      return;
    }

    const newErrors: string[] = [];
    let slots = MAX_FILE_COUNT - items.length - existing.length; // 기존+신규 합산

    for (const file of files) {
      if (slots <= 0) {
        newErrors.push(`${file.name}: 첨부는 최대 ${MAX_FILE_COUNT}개까지 가능합니다`);
        continue;
      }

      const processed = await maybeResize(file);
      // 검증은 리사이즈 후 바이트 기준
      const reason = validateFile(processed.name, processed.size);
      if (reason) {
        newErrors.push(`${file.name}: ${reason}`);
        continue;
      }

      const path = `${user.id}/${crypto.randomUUID()}.${extOf(file.name)}`;
      setUploading((n) => n + 1);
      const { error } = await supabase.storage
        .from("attachments")
        .upload(path, processed, { contentType: processed.type || undefined });
      setUploading((n) => n - 1);

      if (error) {
        newErrors.push(`${file.name}: 업로드 실패 (${error.message})`);
        continue;
      }

      slots -= 1;
      setItems((prev) => [
        ...prev,
        {
          storage_path: path,
          file_name: file.name, // 원본 파일명 보존 (스토리지 키엔 미사용)
          byte_size: processed.size,
          mime_type: processed.type || "application/octet-stream",
        },
      ]);
    }

    setErrors(newErrors);
  }

  async function remove(path: string) {
    const supabase = createClient();
    await supabase.storage.from("attachments").remove([path]);
    setItems((prev) => prev.filter((it) => it.storage_path !== path));
  }

  return (
    <div className="mt-6">
      <label className="inline-flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-forest-300 min-h-[44px]">
        📎 파일 첨부
        <input
          ref={inputRef}
          type="file"
          name="attachment_files"
          multiple
          onChange={handleChange}
          className="hidden"
        />
      </label>
      <span className="ml-3 text-xs text-slate-400">최대 {MAX_FILE_COUNT}개 · 10MB 이하</span>

      {uploading > 0 && (
        <p className="mt-2 text-sm text-forest-700">⏳ 업로드 중… ({uploading})</p>
      )}

      {errors.length > 0 && (
        <ul className="mt-2 space-y-1">
          {errors.map((msg, i) => (
            <li key={i} className="text-sm text-red-600">
              {msg}
            </li>
          ))}
        </ul>
      )}

      {existing.length > 0 && (
        <ul className="mt-3 space-y-2">
          {existing.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
            >
              <span className="truncate">
                {a.file_name}
                <span className="ml-2 text-xs text-slate-400">
                  {(a.byte_size / 1024 / 1024).toFixed(2)}MB
                </span>
              </span>
              <button
                type="button"
                onClick={() => removeExisting(a.id)}
                className="shrink-0 text-slate-400 hover:text-red-500 px-2 py-1 min-h-[44px]"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((it) => (
            <li
              key={it.storage_path}
              className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
            >
              <span className="truncate">
                {it.file_name}
                <span className="ml-2 text-xs text-slate-400">
                  {(it.byte_size / 1024 / 1024).toFixed(2)}MB
                </span>
              </span>
              <button
                type="button"
                onClick={() => remove(it.storage_path)}
                className="shrink-0 text-slate-400 hover:text-red-500 px-2 py-1 min-h-[44px]"
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      <input type="hidden" name="attachments" value={JSON.stringify(items)} />
      <input type="hidden" name="removed_attachment_ids" value={JSON.stringify(removedIds)} />
    </div>
  );
}
