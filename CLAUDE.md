# stock-app

## プロジェクト概要

株式・投資情報を管理・表示するWebアプリケーション。

## 技術スタック

### フロントエンド
- **React** 18.2.0 — UIフレームワーク
- **Vite** 5.0.8 — ビルドツール・開発サーバー
- **Recharts** 2.10.0 — チャート描画ライブラリ

### バックエンド（データ取得）
- **Google Apps Script（GAS）** — Yahoo Finance からの株価データ取得（日本株・米国株対応）
- **Alpha Vantage API** — 米国株データ取得（フォールバック用、無料プラン25回/日）

### データソース
- **Yahoo Finance** `query1.finance.yahoo.com/v8/finance/chart/` — 株価履歴データ
- **Yahoo Finance Japan** `query.finance.yahoo.co.jp/v8/finance/chart/` — 日本株の会社名取得

### インフラ・デプロイ
- **GitHub Pages** — 静的サイトホスティング（公開URL: https://nori1975461.github.io/stock-app）
- **gh-pages** 6.1.1 — デプロイツール（`npm run deploy` で公開）

### ファイル構成
```
stock-app/
├── src/
│   ├── App.jsx          # メインUIコンポーネント
│   ├── App.css          # スタイル（赤系3色テーマ＋ゴールド縁）
│   ├── main.jsx         # エントリーポイント
│   └── utils/
│       ├── api.js       # GAS・Alpha Vantage API通信
│       └── prediction.js # 株価予測ロジック（MA5/MA20/RSI）
└── gas/
    └── Code.gs          # Google Apps Script（GASバックエンド）
```

### 予測ロジック概要
- **MA5**（5日移動平均）と **MA20**（20日移動平均）のクロス判定
- **RSI**（14日）による過熱・過冷感の判定
- スコアリングによる UP/DOWN 判定と確信度（最大85%）

## 主要機能

- 単一銘柄の株価予測（UP/DOWN・確信度・MA5/MA20/RSI・チャート表示）
- 複数銘柄（最大5銘柄）の上昇予測ランキング表示
- ランキングのティッカーシンボルをクリックすると詳細分析を表示
- GAS URL・Alpha Vantage APIキーを localStorage に保存（再入力不要）
- 日本株（.T）・米国株の両対応

## 既知の制限・注意事項

- 日本株の会社名日本語化は未解決（Yahoo Finance APIが英語名を返すため）
- Alpha Vantage 無料プランは25回/日の上限あり（複数銘柄分析で消費が早い）
- Yahoo Finance は非公式APIのため、予告なく仕様変更・遮断の可能性あり
- 予測ロジックはテクニカル指標のみ（ファンダメンタルズ・ニュース等は未考慮）
- 投資判断の根拠としての利用は不可（参考情報のみ）

## 今後実装予定の機能

（実装したい機能をここに追記していく）

## Git 運用ルール

**コードを変更するたびに必ずGitHubへプッシュすること。**

```bash
git add <変更ファイル>
git commit -m "変更内容を簡潔に記述"
git push origin main
```

### 基本方針

- コミットは意味のある単位で行う（機能単位、バグ修正単位など）
- コミットメッセージは日本語でも英語でも可。変更の「なぜ」を明記する
- `main` ブランチへ直接プッシュする（小規模プロジェクトのため）
- 破壊的な変更（ファイル削除、大規模リファクタ）は事前にユーザーへ確認する
- `--no-verify` や `--force` は使用しない（明示的な指示がある場合を除く）

### コミットの流れ

1. `git status` で変更ファイルを確認
2. 関係するファイルを個別に `git add` でステージング（`git add -A` は避ける）
3. `git commit -m "..."` でコミット
4. `git push origin main` でGitHubへプッシュ

## 開発ガイドライン

- セキュリティ脆弱性（XSS、SQLインジェクション等）を絶対に混入しない
- 不要なコメントは書かない（「なぜ」が非自明な場合のみコメントを追加）
- 既存ファイルの編集を優先し、不要な新規ファイルは作成しない
- タスクに必要な最小限の変更のみを行う（過剰な抽象化・リファクタは不要）

## GitHubリポジトリ

https://github.com/nori1975461/stock-app.git

## 注意事項

- 株価データを扱う場合はAPIキーやシークレットを `.env` ファイルで管理し、Gitにコミットしない
- `.env` は必ず `.gitignore` に含める
