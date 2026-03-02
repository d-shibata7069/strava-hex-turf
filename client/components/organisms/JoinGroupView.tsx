"use client";

import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function JoinGroupView() {
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = inviteCode.trim();
    if (!code) {
      setError("招待コードを入力してください");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: code }),
        credentials: "include",
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.message ?? data.error ?? "参加に失敗しました");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-center text-xl font-semibold text-zinc-900">
          グループに参加
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-600">
          招待コードを入力すると、そのグループの陣地が地図に表示され、Strava のアクティビティでタイルを獲得できます。
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="invite_code"
              className="mb-1 block text-sm font-medium text-zinc-700"
            >
              招待コード
            </label>
            <input
              id="invite_code"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              placeholder="例: my-group-001"
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
            {submitting ? "参加中…" : "参加する"}
          </button>
        </form>
        <Link
          href="/"
          className="mt-4 flex w-full items-center justify-center text-sm text-zinc-500 hover:text-zinc-700"
        >
          トップへ戻る
        </Link>
      </div>
    </main>
  );
}
