# 法律・政策情報トラッカー (law-policy-tracker-v3)

主要国（日本/米国/EU）の法令動向・パブコメ・規制ニュース・SEC等を横断表示する PWA 対応のWebアプリです。React + Vite + Tailwind + Framer Motion。

## 主な機能
- 地域タブ（🇯🇵/🇺🇸/🇪🇺）とカテゴリで素早く絞込
- RSS/JSON からの取得とプロキシを使った CORS フォールバック
- スコアベース分類 + ノイズ除外（求人/イベント等）
- 部分描画・バッチ取得で体感速度改善
- PWA（インストール/オフライン一部キャッシュ）
- エラーバウンダリ・ネットワーク復帰時の自動再取得

## ディレクトリ構成
```
.
├── public/
│   ├── icon.svg
│   ├── manifest.json
│   └── sw.js
├── src/
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
└── .gitignore
```

## セットアップ
```bash
npm ci
npm run dev
```
- ブラウザで `http://localhost:5173`（または表示されたURL）へ

## ビルド
```bash
npm run build
```
- 生成物は `dist/`（Gitには含めません）

## デプロイ
- Netlify/Vercel などで「ビルドコマンド: `npm run build` / 公開ディレクトリ: `dist/`」
- GitHub Pages の場合は `gh-pages` ブランチに `dist/` を公開（ソースブランチには含めない）

## PWA
- `public/manifest.json` と `public/sw.js` を同梱
- 本番ドメインでアクセスすると「ホームに追加」等のインストールが可能

## 法的・プライバシー配慮
- 取得先は公的機関/公式RSS/公開APIに限定
- 取得データはクライアント側で一時処理し、個人情報の収集や送信は行いません
- 利用規約やrobotsの変更に注意し、アクセス制御があるサイトにはアクセスしないでください

## ライセンス
- 本リポジトリは MIT ライセンスを予定（`LICENSE` 参照）
