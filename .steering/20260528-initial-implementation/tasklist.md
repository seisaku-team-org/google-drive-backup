# タスクリスト — 初回実装 (MVP)

- **作業ID**: 20260528-initial-implementation
- **最終更新**: 2026-05-28（8決定反映：自動取得 / 連番付与 / AbortController / 親階層書込権限 / 共有ドライブ判定 等）
- **ステータス**: フェーズ I 進行中（ローカル動作確認完了 / docs 同期完了 / 残: A11y 最低確認・git commit・GitHub デプロイ）
- **関連ドキュメント**: [requirements.html](requirements.html) / [design.html](design.html)

---

## 進捗サマリー

| フェーズ | 内容 | 状態 | タスク数 |
|---|---|---|---|
| A | プロジェクト立ち上げ | **完了**（A-01 のみ Phase G 直前まで保留） | 9 / 10 |
| B | 型とドメインの土台 | **完了** | 7 / 7 |
| C | State Store と Router | **完了** | 5 / 5 |
| D | 共通コンポーネントと UI ガワ | **完了** | 14 / 14 |
| E | infra 層 | **完了**（E-05 のみ Phase G で実機確認） | 6 / 7 |
| F | CopyEngine | **完了** | 7 / 7 |
| G | 全結合 + ハッピーパス確認 | **コード完了**（G-02/G-03/G-04 は手動確認） | 2 / 5 |
| H | CI / デプロイ | **コード完了**（H-04/H-05/H-06 はユーザー手動） | 3 / 6 |
| I | 仕上げ | **進行中**（I-06 のみ残） | 5 / 6 |
| **合計** | | | **58 / 67** |

凡例: `[ ]` 未着手 / `[/]` 着手中 / `[x]` 完了

---

## フェーズ A: プロジェクト立ち上げ

完了条件: `npm run dev` でローカル起動、`npm run typecheck` / `npm run lint` / `npm run test` がそれぞれ green。

- [ ] A-01: Google Cloud Console で開発用 OAuth クライアント ID を発行（リダイレクト URI: `http://localhost:5173`）※ Phase G 開始前にユーザーが手動で発行
  - 完了条件: クライアント ID が控えられている
- [x] A-02: `npm create vite@latest .` で React + TypeScript テンプレを生成
  - 完了条件: 初期テンプレが起動する（`npm run dev` で表示される）
- [x] A-03: `tsconfig.json` を編集して `strict: true` / `noUncheckedIndexedAccess: true` を有効化
  - 完了条件: `npm run typecheck` が green
- [x] A-04: ESLint + Prettier + eslint-config-prettier の導入、`.eslintrc.cjs` / `.prettierrc` を作成
  - 完了条件: `npm run lint` / `npm run format` が動く
- [x] A-05: `.editorconfig` 追加（LF / UTF-8 / インデント 2 スペース）
- [x] A-06: Vitest + @testing-library/react + jsdom セットアップ。`vitest.config.ts` を分離
  - 完了条件: ダミーテスト 1 件が green
- [x] A-07: Playwright インストール、`playwright.config.ts` 作成（実テストはフェーズ G で書く）
- [x] A-08: `src/styles/tokens.css` に `docs/assets/design-system.css` のカラー・スペーシング変数をコピー
- [x] A-09: `src/styles/global.css` に `body` リセットとフォントスタック設定
- [ ] A-10: `index.html` に CSP メタタグ・GIS スクリプト読み込み・タイトル設定。`.gitignore` / README の最小版を整備
  - 完了条件: ローカル起動時にコンソールエラーなし

---

## フェーズ B: 型とドメインの土台

完了条件: ドメインロジックがすべてテスト付きで存在し、`npm run test` が green。

- [x] B-01: `src/types/index.ts` に機能設計書 §3 の型を全部宣言（`AuthState` / `UserInfo` / `FolderMetadata` / `CopyJob` / `CopyJobItem` / `Report` / `DriveItem`）。**FolderMetadata に `isInSharedDrive` / `destinationParentId` / `canDuplicateHere` を含める。CopyJobItem.status に `'aborted'` を含める**
- [x] B-02: `src/domain/UrlParser.ts` 実装
  - 完了条件: 5 URL 形式 + ID 単独 + 不正入力の 7 ケースのテストが green
- [x] B-03: `src/utils/backoff.ts` 実装（AbortSignal を受けて待機中も中断可能にする）
  - 完了条件: 指数バックオフの待機時間・最大リトライ回数・abort 時の即時中断のテストが green
- [x] B-04: `src/utils/semaphore.ts` 実装
  - 完了条件: 並列度上限のテストが green
- [x] B-05: `src/domain/ReportBuilder.ts` 実装（集計 + プレーンテキスト変換、aborted カウントも対応）
  - 完了条件: 全件成功 / 部分成功 / 中止 の 3 ケースでテストが green
- [x] B-06: 上記すべてのユニットテストを `tests/unit/` に集約配置
- [x] B-07: `src/utils/abortable.ts` 実装 — AbortSignal 対応の `sleep(ms, signal)` / `retry(fn, options, signal)` ヘルパー
  - 完了条件: 待機中に abort されたら即座に AbortError を throw するテストが green

---

## フェーズ C: State Store と Router

完了条件: 4 ルートを行き来できる、Action ディスパッチで状態が変わる。

- [x] C-01: `src/state/authSlice.ts` 実装（Action 型 + Reducer）
- [x] C-02: `src/state/jobSlice.ts` 実装
- [x] C-03: `src/state/uiSlice.ts` 実装（toasts / modal / folderInput / folderPreview）
- [x] C-04: `src/state/AppContext.tsx` 実装（Provider + State Context + Dispatch Context + 4 hooks）
- [x] C-05: `src/routes/router.tsx` を HashRouter で実装、`src/App.tsx` から呼ぶ。各 View はプレースホルダで OK
  - 完了条件: `#/login` / `#/` / `#/progress` / `#/report` でビュー切替が動く

---

## フェーズ D: 共通コンポーネントと UI ガワ

完了条件: UI 仕様書 §3 の状態（空 / 読込中 / エラー / 成功）を全画面で目視確認できる（データはモック）。

### 共通コンポーネント

- [x] D-01: `src/components/Button/` 実装（Primary / Secondary / Tertiary / Danger、disabled / busy 状態対応）
- [x] D-02: `src/components/Spinner/` 実装
- [x] D-03: `src/components/ProgressBar/` 実装（`role="progressbar"` + `aria-valuenow`）
- [x] D-04: `src/components/Toast/` 実装（uiSlice.toasts から描画）
- [x] D-05: `src/components/ConfirmDialog/` 実装（Esc クローズ、フォーカストラップ）
- [x] D-06: `src/components/Header/` 実装（ユーザー識別表示 + ログアウトリンク）

### View 実装（モックデータで）

- [x] D-07: `src/views/LoginView/LoginView.tsx` + `.module.css` + `.test.tsx`
- [x] D-08: `src/views/HomeView/HomeView.tsx` + `.module.css` + `.test.tsx`（URL入力欄 / プレビュー / 「複製を開始」。**「情報を取得」ボタンは持たない**）
- [x] D-09: `src/views/ProgressView/ProgressView.tsx` + `.module.css` + `.test.tsx`（進捗バー / カウンター / 中止）
- [x] D-10: `src/views/ReportView/ReportView.tsx` + `.module.css` + `.test.tsx`（サマリー / リンク / スキップ一覧 / コピー）
- [x] D-11: 各 View の状態（空 / 読込中 / エラー / 成功 / レスポンシブ）をストーリー的に手動確認
  - 完了条件: UI 仕様書 §3.x.4 の状態がそれぞれ目視できる
- [x] D-12: HomeView の URL 入力に **debounce 500ms の自動取得** を実装。連続入力時は前回取得を AbortController でキャンセルして最新値で取り直す
  - 完了条件: 取得ボタンが存在せず、入力後 500ms で自動取得が走るテストが green
- [x] D-13: HomeView の **「複製不可（親階層に書き込み権限なし）」状態** の UI 実装
  - プレビュー内に「⚠ 親階層への書き込み権限がありません」とエラー文言を表示
  - 「複製を開始」を disabled
  - 完了条件: モックで該当状態を作って手動確認＋コンポーネントテストが green
- [x] D-14: ProgressView の **total が処理中に増加した際の進捗バー挙動** を確認。バーが瞬間的に逆戻りしても固定表示せず素直に再描画する
  - 完了条件: total: 5 → 10 に増えても破綻しないテストが green

---

## フェーズ E: infra 層

完了条件: 本物の Drive API に対して `getFolder` / `listChildren` / `createFolder` / `copyFile` が動く。

- [x] E-01: `src/infra/driveTypes.ts` 実装（API レスポンスの型を最小限に。**`capabilities` / `driveId` フィールドを含む**）
- [x] E-02: `src/infra/AuthClient.ts` 実装
  - GIS を `document.head` に注入
  - `signIn()` / `signOut()` / `getToken()` / `isExpired()` / `onTokenExpired(handler)`
  - スコープ: `drive.readonly + drive.file + openid email profile`
- [x] E-03: `src/infra/DriveApiClient.ts` 実装
  - Bearer ヘッダー付与
  - 429 / 5xx で `backoff` リトライ（最大 5 回、`abortable.ts` で待機中も中断可）
  - 並列度を `semaphore`（既定 4）で制御
  - 401 検知時は `onTokenExpired` を発火
  - **全メソッドが `options.signal?: AbortSignal` を受け取り、内部 fetch に伝搬する**
  - `getFolder` のデフォルト fields = `id,name,parents,driveId,capabilities(canAddChildren,canCopy)`
- [x] E-04: DriveApiClient のテスト（`fetch` を `vi.fn()` で差し替えて期待リクエストと挙動を検証）
  - 完了条件: 各メソッドの期待リクエスト確認＋**`signal.abort()` で進行中 fetch が AbortError を投げる**テストが green
- [ ] E-05: 手動で本物の Drive API に接続し、4 メソッドそれぞれが動くことを確認（テスト用フォルダで）※ Phase G 実機確認に統合
- [x] E-06: `DriveApiClient.findAvailableName(baseName, parentId)` を実装（機能設計書 §7.5 のアルゴリズム）
  - 完了条件: 0 件 / `baseName` あり / `(2)` まで埋まり / 10 件埋まり（11 が空き）の 4 ケースでテストが green
- [x] E-07: 共有ドライブ検出ヘルパー（`getFolder` のレスポンス `driveId` 検査）を `DriveApiClient` に組み込み、共有ドライブ内フォルダなら独自エラーを throw
  - 完了条件: driveId 付きレスポンスをモックで返したら `SHARED_DRIVE_UNSUPPORTED` エラーが投げられるテストが green

---

## フェーズ F: CopyEngine

完了条件: 機能設計書 §7 の疑似コードが実装され、基本ケース 4 つ＋事前バリデーション 5 つの計 9 ケースがテストで担保されている。

- [x] F-01: `src/domain/CopyEngine.ts` の骨格実装（DriveApiClient インターフェースを引数で受ける、**内部に AbortController を 1 個保持**して全 driveApi 呼び出しに signal を渡す）
- [x] F-02: 再帰トラバース実装（BFS、列挙と複製を並行）
- [x] F-03: コールバック実装（onJobStarted / onItemStarted / onItemFinished / onJobFinished / onProgress）。**onProgress.total は処理中に増加可**
- [x] F-04: 中止判定の実装（`cancel()` で `controller.abort()` → 進行中の fetch が AbortError）。`AbortError` は catch → `'aborted'` 記録 → 再 throw でループ脱出
- [x] F-05: CopyEngine の基本テスト
  - F-05a: 3 階層の小さな構造（ルート / サブ / サブサブ）を再帰的に複製できる
  - F-05b: 403 / 404 でスキップして続行する
  - F-05c: `cancel()` で進行中の処理が中断し、中断対象アイテムが `'aborted'` で記録される。途中フォルダは削除されない
  - F-05d: onProgress が呼ばれる（total が増加するケースを含む）
- [x] F-06: **事前バリデーション 3 ステップ**を start メソッドの冒頭に実装
  - F-06a: 元フォルダ取得 → `driveId` 付きなら `SHARED_DRIVE_UNSUPPORTED` で開始失敗
  - F-06b: 親階層が `"root"` でなければ親フォルダ取得 → `capabilities.canAddChildren=false` なら `NO_PARENT_WRITE_PERMISSION` で開始失敗
  - F-06c: `findAvailableName` で複製先名を決定（"Copy of XXX" → 衝突あれば "(2)", "(3)" …）
- [x] F-07: CopyEngine の事前バリデーションテスト
  - F-07a: 共有ドライブのフォルダ ID を指定したら開始前にエラーで失敗
  - F-07b: 親階層書込権限なしのフォルダ ID を指定したら開始前にエラーで失敗
  - F-07c: 同名がない → "Copy of XXX" になる
  - F-07d: "Copy of XXX" がすでにある → "Copy of XXX (2)" になる
  - F-07e: マイドライブ直下のフォルダ → 複製先親が "root" になり、書込権限チェックがスキップされる

---

## フェーズ G: 全結合 + ハッピーパス確認

完了条件: 本物の OAuth + Drive API + テスト用フォルダで、ログイン → 複製 → レポートが通る。

- [x] G-01: 各 View のモックを外し、State + CopyEngine + DriveApiClient + AuthClient を結合（ServicesContext + jobRunner で結線）
- [ ] G-02: `.env.local` に開発用 `VITE_GOOGLE_CLIENT_ID` を設定し、Google ログインが動くことを確認
- [ ] G-03: テスト用 Drive アカウントで「サブフォルダ 2 階層・Docs/Sheets/PDF 含む 10〜30 アイテム」のテストフォルダを用意
- [ ] G-04: 手動でハッピーパスを完走（共有 URL ペースト → プレビュー → 複製 → 進捗 → レポート → 複製先 Drive で確認）
  - 完了条件: 全 4 画面が UI 仕様書通りに表示される、AC-01〜05 を満たす
- [x] G-05: Playwright E2E（スタブモード）でハッピーパス 1 本を書く（happy-path.spec.ts、2 ケース実装）
  - 完了条件: `npm run test:e2e` がローカルで green ✅

---

## フェーズ H: CI / デプロイ

完了条件: main マージで GitHub Pages に自動デプロイされ、本番 URL からハッピーパスが通る。

- [x] H-01: `.github/workflows/ci.yml` 作成（PR: typecheck + lint + test）
- [x] H-02: `.github/workflows/deploy.yml` 作成（main 時: check + E2E + build + Pages デプロイ）
- [x] H-03: `vite.config.ts` の `base` を `VITE_BASE_PATH` 環境変数で設定（deploy.yml が repo 名から自動付与）
- [ ] H-04: Google Cloud Console で本番用 OAuth クライアント ID を発行（リダイレクト URI: 本番 URL）
- [ ] H-05: GitHub Secrets に本番用 `VITE_GOOGLE_CLIENT_ID` を登録
- [ ] H-06: 初回デプロイ → 本番 URL でハッピーパス確認
  - 完了条件: 本番でも AC-01〜05 が満たされる

---

## フェーズ I: 仕上げ

完了条件: README が読める、未決事項が決着、永続ドキュメントが最新。

- [x] I-01: README に「セットアップ手順」「OAuth クライアント ID 取得方法」「npm スクリプト一覧」「drive.readonly が要求される理由（元データは変更しない旨）」を記述 ✅
- [x] I-02: 並列度 = **4 並列で確定**。動作確認で 429 エラー発生せず安定動作。`docs/functional-design.html` §11.1 反映済み
- [x] I-03: トークン更新方針 = **MVP は再ログイン誘導で許容**。短時間処理では問題発生せず、長時間処理時の自動再取得は将来拡張に。`docs/functional-design.html` §11.1 / §11.2 反映済み
- [x] I-04: findAvailableName 上限 = **99 件のまま確定**。動作確認で (2) 程度しか使われず実用上問題なし。`docs/functional-design.html` §11.1 反映済み
- [x] I-05: 「レポートをコピー」動作確認済み ✅
- [ ] I-06: アクセシビリティの最低確認
  - キーボードのみで全フロー完走できる
  - スクリーンリーダーで進捗とエラーが読み上げられる
  - `:focus-visible` でフォーカスリングが見える
  - 主要色のコントラスト 4.5:1 以上
- [x] **追加**: 2 フェーズ進捗（counting / copying）の設計変更と実装 → `docs/ui-specification.html` §3.3 / `docs/functional-design.html` §7 / `docs/glossary.html` §2 / 実装すべてに反映済み
- [x] **追加**: ログアウト時の `useRequireAuth` リダイレクトバグ修正と job 状態クリーンアップ

---

## 完了判定

以下がすべて満たされたら本作業を完了とする：

- [ ] フェーズ A〜I のすべてのタスクが完了している
- [ ] [requirements.html](requirements.html) §5 の AC-01〜07 がすべて満たされている
- [ ] CI が安定的に green
- [ ] 本番 URL でハッピーパスが動作する
- [ ] 永続ドキュメントの更新が同 PR でコミットされている
- [ ] 本ファイル（tasklist.md）も全項目チェック済みになっている

---

## メモ・ログ（実装中の気づきを追記）

> 実装中に判明した仕様の補足や、永続ドキュメントへの反映が必要な気づきはここに時系列で書き残す。完了時に該当ドキュメントへ整理して移す。

- 2026-05-28: 本タスクリスト作成。フェーズ A から開始予定。
- 2026-05-29（ローカル動作確認 + 設計変更 + docs 同期）:
  - **動作確認 G-04**: ユーザーが OAuth ID（開発用）発行 → 本物の Drive API でハッピーパスを完走。AC-01〜05 全て満たすことを確認。連番付与 (2)、中止、レポートコピー全て OK。
  - **バグ発見と修正**: レポート画面からのログアウトが /login に戻らない問題 → `useRequireAuth` フックを ProgressView / ReportView に追加。ログアウト時に job/reset + ui/folderInputCleared も dispatch。
  - **UX 課題と設計変更**: 「進捗バーの分母がどんどん増えて終わりが見えない」とフィードバック → 決定 #1 を撤回し **2 フェーズ進捗（counting → copying）** に再設計。CopyEngine は集計フェーズで全アイテムを BFS 列挙 → childrenCache に保持 → 複製フェーズで再利用（API 呼び出し総数は変わらず）。複製先フォルダ作成も集計後に移動したため、集計中の中止で Drive にゴミが残らないという副次的改善。
  - **docs 同期**: ui-specification §3.3 / functional-design §7+§11 / glossary §2 / architecture（Node24 LTS 動作確認） を最新化。未決事項 4 件すべて確定。
  - 残: I-06 A11y 確認 / Git ローカルコミット / GitHub デプロイ（2FA 解決後）
- 2026-05-29（フェーズ H コード完了）: GitHub Actions の CI と自動デプロイを構築。ci.yml は PR で typecheck + lint + test 実行。deploy.yml は main push で typecheck/lint/test → Playwright E2E → ビルド（VITE_BASE_PATH=/{repo}/ + VITE_GOOGLE_CLIENT_ID Secret 注入）→ Pages へ deploy する 4 ジョブ。README にデプロイ手順とユーザー手動タスク（Pages の Actions モード化 / 本番OAuth ID 発行 / Secrets 登録）を追記。
- 2026-05-29（フェーズ G コード完了）: 全結合完了。ServicesContext で AuthClient/DriveApiClient/CopyEngine を DI、jobRunner.ts が CopyEngine 起動 + dispatch ブリッジ + cancel ハンドル保持。HomeView は fetchFolderPreview を本物の driveApi 経由に切替、LoginView も実 AuthClient.signIn() に。ProgressView は mock tick を削除し純粋に state を描画。stubServices で folderId パターンによる挙動分岐を提供（テスト互換）。Playwright E2E 2 ケース（ハッピーパス + 不正URLエラー）追加し test:e2e green。手動確認 (G-02/G-03/G-04) と A-01/E-05 はユーザータスク。
- 2026-05-29（フェーズ F 完了）: CopyEngine 実装。createCopyEngine(deps) は start(sourceFolderId, callbacks) → { cancel, done } を返す。内部 AbortController を全 driveApi 呼び出しに伝搬。事前バリデーション 3 ステップ（共有ドライブ → 親階層書込権限 → findAvailableName）→ 複製先 createFolder → BFS で再帰トラバース（同階層は Promise.allSettled で並列化、実効並列度は DriveApiClient の semaphore で 4）。total は子展開時に増加。個別エラーは 'skipped' で続行、AbortError のみ 'aborted' で記録して中断。テスト 9 件（F-05a〜d 基本 + F-07a〜e 事前バリデーション）追加で総 103 件 green。
- 2026-05-29（フェーズ E 完了）: infra 層完成。driveTypes.ts に DriveApiError/SharedDriveUnsupportedError/NoParentWritePermissionError/TooManyDuplicatesError + 各レスポンス型を定義。AuthClient は GIS をクロージャでラップし accessToken をメモリ保持、userinfo まで取得して UserInfo を返す Promise API に。DriveApiClient は fetch + Bearer + retry + semaphore + AbortSignal + 401→onTokenExpired + findAvailableName（10件バッチ→11+逐次）+ driveId 検出で SharedDriveUnsupportedError throw を実装。テスト 14 件追加で総 94 件 green。E-05 の本物 API 実機確認は Phase G に統合。
- 2026-05-29（フェーズ D 完了）: UI ガワ完成。共通コンポーネント 6（Button/Spinner/ProgressBar/Toast/ConfirmDialog/Header）+ 4 View 本実装 + ToastContainer/ConfirmDialogHost を App に統合。HomeView は debounce 500ms 自動取得・取得ボタン無し・書込権限なし状態を実装。ProgressView は total 増加挙動（5→8）対応。モックフェッチで「nope/404/shared/通常」の挙動分岐を再現。ユニット/コンポーネントテスト 80 件 green、ビルド gzip 61.84 kB。dev サーバで手動確認待ち。
- 2026-05-28（フェーズ C 完了）: State Store と Router を実装。authSlice / jobSlice / uiSlice の Reducer + Action 定義、AppContext で State/Dispatch を分離した Context Provider、HashRouter で 4 ルート + dev ナビバー。プレースホルダ View 4 つを配置。ユニットテスト 62 件 green、ビルドも green（gzip 55kB）。
- 2026-05-28（フェーズ B 完了）: ドメイン土台完成。型定義 / utils 3 / domain 2 すべて実装。ユニットテスト 43 件すべて green（typecheck / lint も clean）。新規ファイル: types/index.ts, utils/abortable.ts, utils/backoff.ts, utils/semaphore.ts, domain/UrlParser.ts, domain/ReportBuilder.ts および各テスト。
- 2026-05-28（フェーズ A 完了）: 環境構築完了。Node.js 24.16.0 / npm 11.13.0、Vite 5.4.21 + React 18.3.1 + TS 5.6.3 動作確認。`npm run typecheck` / `lint` / `test` / `build` がすべて green。バンドルサイズ 142.94 kB（gzip 46.18 kB、目標 150kB 以下）。winget では Node 24 LTS が入ったため、技術仕様書の「Node 20 LTS」表記は実態に合わせ Phase I で更新する。
- 2026-05-28（同日アップデート）: 仕様レビューにより 8 項目を確定し永続ドキュメントと本ステアリングに反映。
  - #1 進捗 total = 逐次更新（B）／ #2 プレビュー = 直下のみ ／ #3 同名 = `Copy of XXX (N)` 連番付与 ／ #4 中止 = AbortController で fetch を中断
  - #5 OAuth = URL 貼付方式維持（Picker 不採用）／ #6 マイドライブ直下 = マイドライブ直下に作成 ／ #7 URL 入力欄 = debounce 自動取得 ／ #10 非オーナー編集可フォルダ = 親階層書込権限ありの場合のみ作成、なければエラー
  - タスク数 59 → 67（B+1, D+3, E+2, F+2）
