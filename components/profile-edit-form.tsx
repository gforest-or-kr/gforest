"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createUploadUrl } from "@/lib/storage-actions";
import { updateProfileAction } from "@/app/(site)/me/actions";

const OUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const SIZE = 400; // 정사각 축소 — 아바타엔 충분, egress/Storage 절약

// 가운데를 정사각으로 잘라 400×400으로 축소(클라). 대상 포맷만, 나머지는 jpeg로.
async function resizeAvatar(file: File): Promise<{ blob: Blob; ext: string }> {
  const outType = OUT_TYPES.includes(file.type) ? file.type : "image/jpeg";
  const ext = outType === "image/png" ? "png" : outType === "image/webp" ? "webp" : "jpg";
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, outType, 0.9));
  if (!blob) throw new Error("encode");
  return { blob, ext };
}

export default function ProfileEditForm({
  profile,
  avatarUrl,
}: {
  profile: { id: string; nickname: string; name: string; avatar_path: string | null };
  avatarUrl: string | null; // 서버 부모가 풀어 준 현재 아바타 공개 URL
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(profile.nickname);
  const [name, setName] = useState(profile.name);
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [picked, setPicked] = useState<{ blob: Blob; ext: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!OUT_TYPES.includes(f.type)) {
      setError("JPG·PNG·WEBP 이미지만 올릴 수 있어요");
      return;
    }
    setError(null);
    try {
      const r = await resizeAvatar(f);
      setPicked(r);
      setPreview(URL.createObjectURL(r.blob));
    } catch {
      setError("이미지를 처리할 수 없어요");
    }
  }

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const nn = nickname.trim();
    const nm = name.trim();
    if (nn.length < 2 || nn.length > 20) {
      setError("닉네임은 2~20자로 입력해 주세요");
      return;
    }
    if (!nm) {
      setError("이름을 입력해 주세요");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      let avatar_path = profile.avatar_path;

      if (picked) {
        // presigned PUT으로 S3 avatars/{uid}/… 에 직접 업로드(서버 액션이 경로·권한 결정)
        const r = await createUploadUrl("avatars", `avatar.${picked.ext}`, picked.blob.size, picked.blob.type);
        if ("error" in r) {
          setError(r.error);
          return;
        }
        const res = await fetch(r.url, {
          method: "PUT",
          body: picked.blob,
          headers: { "Content-Type": picked.blob.type },
        });
        if (!res.ok) {
          setError("사진 업로드에 실패했어요");
          return;
        }
        avatar_path = r.storage_path;
      }

      // 프로필 갱신(+ 이전 아바타 정리)은 서버 액션 — RLS(본인 행) 강제
      const result = await updateProfileAction({ nickname: nn, name: nm, avatar_path });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPicked(null);
      setSaved(true);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="rounded-3xl bg-forest-50 p-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-16 h-16 rounded-full overflow-hidden bg-forest-600 text-white grid place-items-center text-xl font-bold shrink-0"
          aria-label="프로필 사진 변경"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            nickname.slice(0, 1) || "?"
          )}
          <span className="absolute inset-x-0 bottom-0 bg-black/40 text-[10px] py-0.5 text-center">변경</span>
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onPick} className="hidden" />
        <div className="min-w-0 space-y-2 flex-1">
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="w-full border border-slate-200 rounded-xl text-sm px-3 py-2 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-0.5">이름</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-slate-200 rounded-xl text-sm px-3 py-2 bg-white"
            />
          </div>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {saved && !error && <p className="mt-3 text-sm text-forest-700">저장되었습니다.</p>}

      <div className="mt-4 flex justify-end">
        <button
          disabled={busy}
          className="bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </div>
    </form>
  );
}
