import Link from "next/link";

/**
 * プライバシーポリシーページ。Strava API 公開審査およびユーザー向けの法務情報。
 */
export default function PrivacyPage({
  searchParams,
}: {
  searchParams: { from?: string };
}) {
  const fromSettings = searchParams.from === "settings";

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-zinc-50 px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <div className="mb-8">
          <Link
            href={fromSettings ? "/settings" : "/"}
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            {fromSettings ? "← 設定へ戻る" : "← トップへ"}
          </Link>
        </div>

        <h1 className="mb-8 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          プライバシーポリシー
        </h1>

        <div className="space-y-8 text-base leading-relaxed text-zinc-700">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              1. Strava から取得するデータと利用目的
            </h2>
            <p className="mb-2">
              本サービスは、Strava API を通じて以下のデータを取得し、陣取りゲームの提供に利用します。
            </p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>
                <strong>プロフィール情報</strong>
                ：表示名、プロフィール画像（アイコン）— グループ内での識別およびランキング・活動ログの表示に使用します。
              </li>
              <li>
                <strong>アクティビティの位置情報（GPS データ）</strong>
                ：ランニング等のアクティビティに含まれる緯度・経度 — 通過したエリア（H3 タイル）の陣地獲得・防衛・減衰の判定に使用します。
              </li>
            </ul>
            <p className="mt-3">
              上記データは、陣取りゲームの進行、グループ内でのランキング表示、Activity Log（奪取・防衛などの履歴）の表示にのみ利用し、これら以外の目的では利用しません。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              2. データの保存と保護方針
            </h2>
            <p>
              取得したデータは、本サービスのバックエンド（Supabase）において安全に保存・管理します。アクセス制御、通信の暗号化（HTTPS）等の一般的なセキュリティ対策を講じ、第三者への不正な開示・漏洩を防ぐよう努めます。Strava から取得する権限は、サービスに必要な最小限の範囲に限定しています。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              3. アカウント削除時のデータ消去
            </h2>
            <p>
              ユーザーは、設定画面から自らのアカウントを削除することができます。アカウント削除時には、当該ユーザーに紐づくプロフィール情報、陣地データ、活動ログ等のデータを削除し、復元できない状態にします。削除の手順は、アプリ内の「アカウント設定」から「アカウントを完全に削除する」により実行できます。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              4. ユーザーの同意について
            </h2>
            <p>
              本サービスを利用することにより、本プライバシーポリシーに記載したデータの取得・利用・保存に同意したものとみなします。Strava の認可画面において、本サービスがリクエストする権限（プロフィール・アクティビティの読み取り等）を許可していただく必要があります。同意いただけない場合、本サービスはご利用いただけません。
            </p>
          </section>

          <section>
            <p className="text-sm text-zinc-500">
              本ポリシーは、法令の変更やサービス内容の変更に応じて改定することがあります。重要な変更がある場合は、アプリ内または適切な方法でお知らせします。
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
