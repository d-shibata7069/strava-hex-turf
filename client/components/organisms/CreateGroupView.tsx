"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CreateGroupView() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdInviteCode, setCreatedInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreatedInviteCode(null);
    const n = name.trim();
    if (!n) {
      setError("グループ名を入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n }),
        credentials: "include",
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        invite_code?: string;
      };
      if (!res.ok) {
        setError(data.message ?? data.error ?? "作成に失敗しました");
        return;
      }
      if (typeof data.invite_code === "string") {
        setCreatedInviteCode(data.invite_code);
      } else {
        setCreatedInviteCode(null);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopyInviteCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (createdInviteCode) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-zinc-50 px-4">
        <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h1 className="mb-2 text-center text-xl font-semibold text-zinc-900">
            グループを作成しました
          </h1>
          <p className="mb-6 text-center text-sm text-zinc-600">
            招待コードをメンバーに共有して参加してもらえます。
          </p>
          <div className="mb-6 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3">
            <code className="min-w-0 flex-1 truncate font-mono text-sm text-zinc-900">
              {createdInviteCode}
            </code>
            <button
              type="button"
              onClick={() => handleCopyInviteCode(createdInviteCode)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              title={copied ? "コピーしました" : "招待コードをコピー"}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-green-600" aria-hidden />
                  コピーしました
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden />
                  コピー
                </>
              )}
            </button>
          </div>
          <Link
            href="/groups"
            className="block w-full rounded-lg bg-orange-500 px-4 py-3 text-center text-sm font-medium text-white hover:bg-orange-600"
          >
            グループ一覧へ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-zinc-900">
          グループを作成
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-600">
          グループ名を入力すると、招待コードが自動で発行されます。
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              グループ名
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 週末ラン部"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              disabled={submitting}
              autoComplete="off"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting ? "作成中…" : "作成する"}
          </button>
        </form>
        <Link
          href="/groups"
          className="mt-4 flex w-full items-center justify-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          グループ一覧へ
        </Link>
      </div>
    </main>
  );
}
