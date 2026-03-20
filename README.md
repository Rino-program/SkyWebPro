# SkyWebPro

SkyWebPro は AT Protocol (Bluesky) 向けの静的 Web クライアントです。
ビルド不要で GitHub Pages にそのまま公開できます。

## 機能

- ホームタイムライン（Following / Discover）
- 通知（30秒ポーリング）
- 投稿 / 返信 / 引用 / 削除
- 画像投稿（最大4枚、1枚あたり 1MB 制限）
- 検索（投稿 / ユーザー）
- DM 一覧 / チャット
- リスト表示
- プロフィール編集（表示名、自己紹介、アバター、バナー）
- 下書き保存
- クイック投稿モーダル
- 右下 Control Deck（表示カスタマイズ、ミニ分析、ノート、完全ミニ）
- ログイン画面の接続診断とログ表示

## 動作環境

- 最新の Chrome / Edge / Safari / Firefox
- JavaScript 有効
- HTTPS 配信（GitHub Pages 推奨）

## クイックスタート

```bash
git clone https://github.com/Rino-program/skywebpro.git
cd skywebpro
```

ローカル確認は、静的ファイルサーバーで配信してください。

```bash
# 例: Python
python -m http.server 8080
```

コード品質チェック:

```bash
npm install
npm run lint
npm run format:check
npm test
```

## 公開手順（GitHub Pages）

このリポジトリには Pages 用ワークフローが含まれています。

- ワークフロー: .github/workflows/deploy.yml
- トリガー: main ブランチへの push

手順:

1. GitHub リポジトリを作成（Public 推奨）
2. main ブランチへ push
3. リポジトリ設定の Pages で Source を GitHub Actions に設定
4. Actions の Deploy SkyWebPro to GitHub Pages が完了したら公開 URL で確認

公開 URL 例:

[https://your-account.github.io/your-repo/](https://your-account.github.io/your-repo/)

## ログイン情報

通常パスワードではなく、Bluesky のアプリパスワードを使ってください。

手順:

1. Bluesky の 設定 → アプリパスワード
2. 新規発行
3. SkyWebPro のログイン画面で入力

注意:

- ハンドル入力に @ は不要
- DM 利用時は、発行時に DM アクセス許可を有効化

## セキュリティポリシー

- セッション情報はブラウザストレージに保存されます
- 共用端末での利用は非推奨
- 利用後はログアウトを推奨
- 外部リンク遷移時は確認ダイアログを表示
- CSP / Referrer-Policy / Permissions-Policy を設定済み

## 既知事項

- 一部環境（Safari、学校・組織フィルタ環境）では接続失敗になる場合があります
- ログイン画面の 接続診断 で以下を確認できます: Public API 到達 / Chat API 到達 / Handle Resolve / Storage 書き込み可否
- Chat API の 401/403 は未認証時の想定レスポンスで、到達確認としては正常です

## フィルタリング環境での確認項目（管理者向け）

以下ドメインの許可を確認してください。

- [https://bsky.social](https://bsky.social)
- [https://api.bsky.chat](https://api.bsky.chat)

以下通信の許可を確認してください。

- OPTIONS / GET / POST
- カスタムヘッダー Atproto-Proxy

## プロジェクト構成

```text
.
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ api.js
│  ├─ constants.js
│  ├─ ui.js
│  └─ app.js
├─ .eslintrc.cjs
├─ .prettierrc.json
├─ package.json
├─ assets/
└─ .github/workflows/deploy.yml
```

## 免責

本プロジェクトは Bluesky 非公式クライアントです。
運用時は組織のセキュリティポリシーおよび利用規約に従ってください。

## ドキュメント

- 開発参加手順: `CONTRIBUTING.md`
- 変更履歴: `CHANGELOG.md`
- 実装ステータス: `IMPLEMENTATION_STATUS.md`
- トラブル対応: `TROUBLESHOOTING.md`
- バージョニング方針: `VERSIONING.md`
- 既知の制限: `KNOWN_LIMITATIONS.md`
- ブラウザサポート: `BROWSER_SUPPORT.md`
- デプロイ復旧手順: `DEPLOY_RECOVERY.md`
- セキュリティ方針: `SECURITY.md`

## 配布について

改変して共有する事は可能です、その場合は原作者として@Rino-programを記載してくれると嬉しいです(必須ではない)。
改変したかどうかに関わらず、完全なオリジナルとして出す事や売って金銭をもらう事は禁止します。
