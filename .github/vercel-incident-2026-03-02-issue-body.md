## 概要

Vercel へのデプロイ時に、ビルドは成功するが **「Deploying outputs」** 段階で `Error: We encountered an internal error. Please try again.` が発生した。

## 原因（Vercel 側インシデント）

- **インシデント:** [Elevated deployment and function invocations failures in Dubai region (dxb1)](https://www.vercel-status.com/)
- **発生日:** 2026年3月2日頃
- **影響範囲:** **Middleware** を使用しているビルドが全リージョンで影響を受ける（Middleware は本番でグローバル配信されるため、dxb1 の不調がデプロイ全体に波及）
- **本プロジェクト:** `client/middleware.ts` で next-intl の Middleware を使用しているため該当

## 実施した切り分け（参考）

- h3-js（WASM）をクライアントバンドルから除外したビルドでも **同様の Internal Error** が再現した
- よって原因は **WASM やビルド成果物の内容ではなく、Vercel の Middleware 配信まわりの障害** と判断

## 対応・ステータス

- Vercel により **Middleware を使用するビルドから Dubai (dxb1) を一時除外するミティゲーション** が展開されている
- [Vercel Status](https://www.vercel-status.com/) で解消を確認後、再デプロイすれば正常に通る見込み

## 関連リンク

- [Vercel Status - 現在のインシデント](https://www.vercel-status.com/)
- [Vercel ヘルプ（問い合わせ）](https://vercel.com/help)
