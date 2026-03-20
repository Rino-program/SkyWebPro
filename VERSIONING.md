# Versioning Policy

SkyWebPro は SemVer 互換の運用を目指します。

## 形式

`MAJOR.MINOR.PATCH`

- MAJOR: 後方互換性のない変更
- MINOR: 後方互換性のある機能追加
- PATCH: 後方互換性のある修正

## リリース運用

- 開発中の変更は `CHANGELOG.md` の `[Unreleased]` に追記。
- リリース時にバージョン見出しを追加して移動。
- 重大変更は README と合わせて案内する。

## 目安

- UIの小修正: PATCH
- 新設定や新機能: MINOR
- 設定互換が壊れる変更: MAJOR
