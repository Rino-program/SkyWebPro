# Contributing Guide

SkyWebPro へのコントリビュートありがとうございます。小さな修正でも歓迎です。

## 開発セットアップ

1. リポジトリをクローンします。
1. 静的サーバーで配信します。

```bash
git clone https://github.com/Rino-program/skywebpro.git
cd skywebpro
python -m http.server 8080
```

1. ブラウザで `http://localhost:8080` を開きます。

## ブランチ運用

1. `main` から作業ブランチを作成します。
2. 1つの目的に対して1つのPRを作成します。
3. PRタイトルは変更内容が分かる文にします。

## コーディング方針

- 既存スタイル（素の HTML/CSS/JS）を維持する。
- 無関係な大規模整形を避ける。
- ユーザー向け文言は日本語で統一する。
- localStorage キー追加時は命名規則 `skywebpro_*_v1` を使う。

## 動作確認チェックリスト

- ログイン / ログアウト
- ホーム表示（Following / Discover）
- 投稿（通常 / 返信 / 引用）
- 通知表示
- 検索（投稿 / ユーザー）
- モバイル幅で崩れがないこと

## PR チェックリスト

- [ ] 変更の目的と背景を説明した
- [ ] 主要導線を手動確認した
- [ ] 既存機能を壊していない
- [ ] UI変更がある場合はスクリーンショットを添付した
- [ ] セキュリティ的な影響を確認した

## Issue 報告

バグ報告時は以下を記載してください。

- 事象の要約
- 再現手順
- 期待結果 / 実際結果
- ブラウザ名とバージョン
- 可能ならスクリーンショット

テンプレート:

- バグ報告: `.github/ISSUE_TEMPLATE/bug_report.md`
- 機能要望: `.github/ISSUE_TEMPLATE/feature_request.md`
- PR: `.github/pull_request_template.md`
