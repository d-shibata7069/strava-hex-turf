import Link from "next/link";

/**
 * 利用規約ページ。Strava API 公開審査およびユーザー向けの法務情報。
 */
export default function TermsPage({
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
          利用規約
        </h1>

        <div className="space-y-8 text-base leading-relaxed text-zinc-700">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              1. サービスの目的と自己責任での利用
            </h2>
            <p className="mb-2">
              本サービスは、Strava に記録されたランニング等のアクティビティに基づき、通過したエリアを「陣地」として可視化する陣取りゲームを提供するものです。本サービスの利用は、すべてユーザーご自身の責任で行ってください。
            </p>
            <p className="mb-2">
              <strong>位置情報ゲームに伴う注意事項（免責事項）</strong>
              ：本サービスは、走行ルートや陣地の獲得を楽しむためのものです。利用にあたっては、以下の点を遵守してください。
            </p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>
                <strong>交通ルールの遵守</strong>
                ：走行時は、道路交通法および現地の交通ルールを守り、安全を最優先に行動してください。
              </li>
              <li>
                <strong>危険な場所への立ち入り禁止</strong>
                ：私有地・立入禁止区域・工事現場・災害危険区域など、立ち入りが禁止または危険な場所には入らないでください。陣地獲得を目的とした無理なルート選択による事故・トラブルについて、運営は一切の責任を負いません。
              </li>
              <li>
                <strong>体調・環境の自己管理</strong>
                ：熱中症、転倒、不審者等への対策はユーザー自身で行い、無理のない範囲でご利用ください。
              </li>
            </ul>
            <p className="mt-3">
              上記に違反した利用や、それに起因する損害について、運営は責任を負いかねます。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              2. アカウントの取り扱い（Strava アカウントとの連携）
            </h2>
            <p>
              本サービスは、Strava の OAuth による認証を利用します。利用開始には、Strava アカウントとの連携および本サービスが求める権限の許可が必要です。Strava の利用規約・プライバシーポリシーにも従ってご利用ください。グループへの参加は、招待リンク経由でのみ可能です。アカウントの削除は、本アプリの設定画面から行うことができ、削除後はデータが消去されます。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              3. 禁止事項
            </h2>
            <p className="mb-2">
              以下の行為は禁止します。
            </p>
            <ul className="list-inside list-disc space-y-1 pl-2">
              <li>
                <strong>チート行為</strong>
                ：虚偽の位置情報の送信、不正なツール・スクリプトの使用、Strava のデータを改ざんしての登録など、公平なゲーム進行を妨げる行為。
              </li>
              <li>
                <strong>Strava API の不正利用</strong>
                ：Strava の API 利用規約に反する利用、過度なリクエスト、他者になりすましてのアクセスなど。
              </li>
              <li>
                その他、法令または Strava の利用規約に違反する行為、他のユーザーや第三者に迷惑・損害を与える行為。
              </li>
            </ul>
            <p className="mt-3">
              禁止事項に該当する行為が確認された場合、アカウントの停止または削除等の対応を行うことがあります。
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-zinc-900">
              4. 免責事項と規約の変更
            </h2>
            <p className="mb-2">
              <strong>免責事項</strong>
              ：本サービスは「現状のまま」提供されます。サービスの中止・変更・不具合、または利用に起因するいかなる損害についても、運営は責任を負いません。位置情報ゲームの利用に伴う事故・トラブルは、前述のとおりユーザーの自己責任でご対応ください。
            </p>
            <p>
              <strong>規約の変更</strong>
              ：本規約は、必要に応じて変更することがあります。重要な変更がある場合は、アプリ内または適切な方法でお知らせします。変更後の利用規約の効力発生日以降にサービスを利用した場合、変更後の規約に同意したものとみなします。
            </p>
          </section>

          <section>
            <p className="text-sm text-zinc-500">
              本規約は、日本法に準拠し、本サービスに関する争議については、運営の本拠地を管轄する裁判所を専属的合意管轄とします。
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
