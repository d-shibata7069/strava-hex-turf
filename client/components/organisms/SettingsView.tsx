"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/atoms";

export interface SettingsViewProps {
  displayName: string | null;
  iconUrl: string | null;
}

/**
 * アカウント設定画面。現在のユーザー情報、将来の拡張枠、退会（Danger Zone）を表示する。
 */
export function SettingsView({ displayName, iconUrl }: SettingsViewProps) {
  const router = useRouter();

  async function handleDeleteAccount() {
    const ok = window.confirm(
      "アカウントを完全に削除します。陣地データを含むすべてのデータが削除されます。この操作は取り消せません。よろしいですか？"
    );
    if (!ok) return;

    const res = await fetch("/api/me", { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(body?.message ?? "削除に失敗しました。");
      return;
    }
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <h1 className="text-xl font-semibold text-zinc-900">アカウント設定</h1>

      {/* 現在のユーザー情報 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">現在のアカウント</h2>
        <div className="flex items-center gap-4">
          <Avatar src={iconUrl} size="md" />
          <span className="font-medium text-zinc-900">{displayName ?? "ユーザー"}</span>
        </div>
      </section>

      {/* 将来の拡張枠（ダミー） */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">プライバシー設定</h2>
        <p className="text-sm text-zinc-400">（準備中）</p>
      </section>
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-medium text-zinc-500">通知設定</h2>
        <p className="text-sm text-zinc-400">（準備中）</p>
      </section>

      {/* Danger Zone */}
      <section className="rounded-lg border-2 border-red-200 bg-red-50/50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-red-800">Danger Zone</h2>
        <p className="mb-4 text-sm text-red-700">
          アカウントを削除すると、あなたの陣地・グループ参加履歴・活動ログなどのデータはすべて削除されます。この操作は取り消せません。
        </p>
        <button
          type="button"
          onClick={handleDeleteAccount}
          className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          アカウントを完全に削除する
        </button>
      </section>
    </div>
  );
}
