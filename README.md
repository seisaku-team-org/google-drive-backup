# Google Drive バックアップ

Google Drive 上のフォルダを **「Copy of 元フォルダ名」** として同じ親階層にまるごと複製する Web アプリ。
ローカル PC のストレージは使わず、Drive 内で完結する。

> 📖 ドキュメントは [`docs/index.html`](docs/index.html) を参照。プロジェクト方針は [`CLAUDE.md`](CLAUDE.md) を参照。

## セットアップ

### 前提

- Node.js 20+（推奨 20 LTS。Node 24 LTS も動作確認済み）
- npm 10+
- Google アカウント（OAuth クライアント ID 発行に必要）

### 1. 依存導入

```pwsh
npm install
```

### 2. Google OAuth クライアント ID の発行

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「API とサービス」→「OAuth 同意画面」を構成（外部、必須 scope なし）
3. 「API とサービス」→「認証情報」→「OAuth クライアント ID を作成」
   - アプリケーションの種類: **ウェブアプリケーション**
   - 承認済みの JavaScript 生成元: `http://localhost:5173`（開発）
   - 承認済みのリダイレクト URI: 不要（implicit token client を使うため）
4. 発行されたクライアント ID をコピー
5. プロジェクト直下に `.env.local` を作成し以下を記述:

```
VITE_GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
```

> `.env.local` は `.gitignore` 対象。コミットされない。

### 3. 開発サーバ起動

```pwsh
npm run dev
```

`http://localhost:5173` をブラウザで開く。

## npm スクリプト

| スクリプト | 内容 |
| --- | --- |
| `npm run dev` | Vite 開発サーバ起動 |
| `npm run build` | 本番ビルド（typecheck 込み） |
| `npm run preview` | 本番ビルドをローカル確認 |
| `npm run typecheck` | TypeScript 型チェック |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 整形 |
| `npm run test` | Vitest（単体・watch なし） |
| `npm run test:watch` | Vitest watch |
| `npm run test:e2e` | Playwright E2E |

## ディレクトリ構成

詳細は [`docs/repository-structure.html`](docs/repository-structure.html) を参照。要旨：

```
src/
├── views/        # 画面コンポーネント（SCR-001〜004）
├── components/   # 共通 UI 部品
├── state/        # State Store（Context + Reducer）
├── domain/       # ビジネスロジック（CopyEngine 等）
├── infra/        # 外部 IO（AuthClient / DriveApiClient）
├── types/        # ドメイン共通型
├── utils/        # 汎用ユーティリティ
└── styles/       # トークン・グローバル CSS
```

## OAuth スコープについて

本アプリは下記の Google OAuth スコープを要求します（[`docs/architecture.html`](docs/architecture.html) §6.1）：

- `drive.readonly` — URL 貼り付け方式で任意の Drive フォルダのメタデータ・子要素を読むため必須
- `drive.file` — 本アプリが作成する複製先フォルダ・コピー済みファイルへの書き込み
- `openid email profile` — ログイン中ユーザーの識別表示

> ⚠️ `drive.readonly` は Drive 全体の読み取り権限ですが、**本アプリは元フォルダ・元ファイルへの書き込み・削除を一切行いません**。
> 書き込みは `drive.file` の範囲（本アプリが作ったファイルのみ）に限定されるため、構造的に元データを変更できません。

## CI / デプロイ

### CI（PR 時の自動検証）

`.github/workflows/ci.yml` が PR ごとに以下を実行する：

- `npm run typecheck`
- `npm run lint`
- `npm run test`（単体テスト）

E2E（Playwright）は時間がかかるため PR では実行せず、デプロイワークフローでのみ実行する。

### 本番デプロイ（GitHub Pages 自動）

`.github/workflows/deploy.yml` が `main` への push で動く：

1. 静的解析 + 単体テスト
2. Playwright E2E（スタブモード）
3. ビルド（`VITE_BASE_PATH=/{repo-name}/` を自動付与）
4. GitHub Pages に upload + deploy

#### セットアップ手順（リポジトリ管理者向け）

1. **GitHub Pages を Actions モードに**
   リポジトリの Settings → Pages → "Build and deployment" の Source を **"GitHub Actions"** に設定

2. **本番用 OAuth クライアント ID を発行**
   [Google Cloud Console](https://console.cloud.google.com/) で本番用クライアント ID を新規作成
   - 承認済みの JavaScript 生成元: `https://<org-or-user>.github.io`
   - リダイレクト URI は不要

3. **GitHub Secrets に登録**
   リポジトリの Settings → Secrets and variables → Actions → "New repository secret"
   - Name: `VITE_GOOGLE_CLIENT_ID`
   - Value: 上で発行した本番用クライアント ID

4. **main に push する**
   ワークフローが自動的に走り、`https://<org-or-user>.github.io/{repo-name}/` で公開される

## ライセンス・規約

（今後追記）
