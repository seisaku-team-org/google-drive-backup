/**
 * ドメイン共通型
 * 機能設計書 §3「データモデル」に定義された全エンティティを宣言する。
 * 1 つの層に閉じる型は当該層のフォルダ（infra/driveTypes.ts 等）に置くこと。
 */

// ============================================================
// 認証
// ============================================================

export type AuthStatus = 'unauthenticated' | 'authenticating' | 'authenticated';

export type UserInfo = {
  id: string;
  email: string;
  name: string;
};

export type AuthState = {
  status: AuthStatus;
  accessToken: string | null;
  expiresAt: number | null;
  user: UserInfo | null;
};

// ============================================================
// フォルダ・アイテム
// ============================================================

/** Drive アイテムの種別。フォルダ／ファイル／ショートカット */
export type ItemKind = 'folder' | 'file';

/**
 * 複製対象フォルダのメタデータ。
 * UI のプレビューおよび複製可否の判定に使う。
 */
export type FolderMetadata = {
  id: string;
  name: string;
  parents: string[];
  pathDisplay: string;
  /** 直下のアイテム数（再帰総数ではない）*/
  itemCount: number;
  /** files.get のレスポンスに driveId が含まれていれば true */
  isInSharedDrive: boolean;
  /** parents[0] か、無ければ 'root'（マイドライブ直下）*/
  destinationParentId: string;
  /**
   * 複製先親階層への書き込み権限の有無（capabilities.canAddChildren）。
   * false の場合、UI 上で「複製を開始」を無効化する。
   */
  canDuplicateHere: boolean;
};

// ============================================================
// 複製ジョブ
// ============================================================

export type CopyJobStatus =
  | 'idle'
  | 'preparing'
  | 'running'
  | 'cancelling'
  | 'completed'
  | 'cancelled'
  | 'failed';

export type CopyJob = {
  id: string;
  sourceFolderId: string;
  destinationFolderId: string | null;
  destinationName: string;
  status: CopyJobStatus;
  startedAt: number;
  finishedAt: number | null;
  cancelRequested: boolean;
};

export type CopyJobItemStatus =
  | 'pending'
  | 'in_progress'
  | 'success'
  | 'skipped'
  /** ユーザー中止により AbortController で中断された場合 */
  | 'aborted';

export type CopyJobItem = {
  id: string;
  jobId: string;
  sourceId: string;
  sourceName: string;
  sourcePath: string;
  kind: ItemKind;
  status: CopyJobItemStatus;
  errorMessage: string | null;
};

// ============================================================
// 進捗
// ============================================================

/** ジョブのフェーズ。'counting' は事前列挙、'copying' は実際の複製処理 */
export type JobPhase = 'counting' | 'copying';

/** CopyEngine から State へ渡す進捗スナップショット */
export type ProgressSnapshot = {
  /** 現在のフェーズ。'counting' 中は total が増え続け、'copying' 中は total が固定 */
  phase: JobPhase;
  /** 既知のアイテム総数。counting 中は増加、copying 中は固定 */
  total: number;
  /** 確定済み件数（success + skipped + aborted）。counting 中は 0 */
  done: number;
  /** 進行中のアイテム名（UI 表示用）。counting 中は集計中のフォルダ名 */
  currentItemName: string | null;
  successCount: number;
  skipCount: number;
  abortedCount: number;
};

// ============================================================
// レポート（派生データ）
// ============================================================

export type Report = {
  jobId: string;
  successCount: number;
  skipCount: number;
  abortedCount: number;
  /** ms 単位の所要時間（finishedAt - startedAt）*/
  durationMs: number;
  /** Drive 上の複製先フォルダ URL。未作成なら空文字 */
  destinationUrl: string;
  destinationName: string;
  skippedItems: CopyJobItem[];
  abortedItems: CopyJobItem[];
};

// ============================================================
// 共通ユーティリティ型
// ============================================================

/** 結果オブジェクトの汎用形 */
export type Ok<T> = { ok: true; value: T };
export type Err<E> = { ok: false; reason: E };
export type Result<T, E> = Ok<T> | Err<E>;
