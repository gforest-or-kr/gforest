"use client";

import { useRef, useState } from "react";
import { createUploadUrl, deleteOwnUpload } from "@/lib/storage-actions";
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

type ExistingAttachment = {
  id: string;
  file_name: string;
  byte_size: number;
  mime_type: string | null;
};

// 업로드 흐름: 서버 액션(createUploadUrl)이 권한·형식 검증 후 presigned PUT URL과 storage_path
// ({uid}/{uuid}.{ext})를 발급 → 브라우저가 S3에 직접 PUT. 행 insert는 글 저장(createPost/updatePost) 시점.
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

      const mime = processed.type || "application/octet-stream";
      setUploading((n) => n + 1);
      let path: string | null = null;
      try {
        // 서버가 권한(로그인·pending 아님)·형식을 검증하고 본인 폴더 경로를 발급한다
        const r = await createUploadUrl("attachments", file.name, processed.size, mime);
        if ("error" in r) {
          newErrors.push(`${file.name}: ${r.error}`);
          continue;
        }
        const res = await fetch(r.url, {
          method: "PUT",
          body: processed,
          headers: { "Content-Type": mime },
        });
        if (!res.ok) {
          newErrors.push(`${file.name}: 업로드 실패 (${res.status})`);
          continue;
        }
        path = r.storage_path;
      } catch {
        newErrors.push(`${file.name}: 업로드 실패`);
        continue;
      } finally {
        setUploading((n) => n - 1);
      }

      slots -= 1;
      setItems((prev) => [
        ...prev,
        {
          storage_path: path!,
          file_name: file.name, // 원본 파일명 보존 (스토리지 키엔 미사용)
          byte_size: processed.size,
          mime_type: mime,
        },
      ]);
    }

    setErrors(newErrors);
  }

  // 등록 전 첨부 취소 — 본인 폴더 객체만 지운다(서버 액션이 uid 프리픽스 검사)
  async function remove(path: string) {
    await deleteOwnUpload("attachments", path);
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
