/**
 * Drive API v3 のレスポンス型（必要な部分のみ）と独自エラー。
 * これら型は infra レイヤー内に閉じる。views/state/domain は src/types/index.ts の
 * 抽象的な型を使うこと。
 */

export type DriveCapabilities = {
  canAddChildren?: boolean;
  canCopy?: boolean;
};

export type DriveFileResource = {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
  /** 共有ドライブ内のアイテムにのみ付与される */
  driveId?: string;
  capabilities?: DriveCapabilities;
  size?: string;
};

export type DriveListResponse = {
  files: DriveFileResource[];
  nextPageToken?: string;
};

/** Drive API の MIME type 定数 */
export const MIME = {
  folder: 'application/vnd.google-apps.folder',
  shortcut: 'application/vnd.google-apps.shortcut',
} as const;

/** HTTP ステータス + Drive 固有 reason を保持する一般エラー */
export class DriveApiError extends Error {
  readonly status: number;
  readonly reason: string;
  constructor(opts: { status: number; reason: string; message?: string }) {
    super(opts.message ?? `Drive API ${opts.status}: ${opts.reason}`);
    this.name = 'DriveApiError';
    this.status = opts.status;
    this.reason = opts.reason;
  }
}

/** 共有ドライブ内のアイテムを操作しようとした場合 */
export class SharedDriveUnsupportedError extends Error {
  constructor() {
    super('共有ドライブ（チームドライブ）内のフォルダは現在サポートしていません。');
    this.name = 'SharedDriveUnsupportedError';
  }
}

/** 複製先親階層への書き込み権限が無い場合 */
export class NoParentWritePermissionError extends Error {
  constructor() {
    super('このフォルダの親階層に複製を作成する権限がありません。');
    this.name = 'NoParentWritePermissionError';
  }
}

/** findAvailableName が 99 件まで埋まっていた場合 */
export class TooManyDuplicatesError extends Error {
  constructor(baseName: string) {
    super(`同名フォルダの連番が上限に達しました: ${baseName}`);
    this.name = 'TooManyDuplicatesError';
  }
}
