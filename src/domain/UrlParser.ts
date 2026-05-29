/**
 * 共有 URL からフォルダ ID を抽出する純粋関数。
 * 機能設計書 §4.2 に対応。React 非依存・副作用なし。
 */

export type ParseFolderUrlResult =
  | { ok: true; folderId: string }
  | { ok: false; reason: 'INVALID_URL' | 'NOT_A_FOLDER' };

/** Drive ファイル ID の文字種（公式仕様による厳密な長さの定義は無いが 20 文字以上が一般的）*/
const ID_PATTERN = /^[A-Za-z0-9_-]{20,}$/;

const FOLDER_URL_PATTERNS: RegExp[] = [
  // /drive/folders/{id}, /drive/u/0/folders/{id}, /folders/{id} 等
  /drive\.google\.com\/(?:drive\/)?(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{20,})/,
];

const ID_QUERY_PATTERNS: RegExp[] = [
  // /open?id={id} （Drive の旧 UI でよく使われた）
  /drive\.google\.com\/open\?(?:[^#]*&)?id=([A-Za-z0-9_-]{20,})/,
];

const FILE_URL_PATTERN = /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{20,})/;

export function parseFolderUrl(input: string): ParseFolderUrlResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: 'INVALID_URL' };

  // 1) 単独 ID
  if (ID_PATTERN.test(trimmed)) {
    return { ok: true, folderId: trimmed };
  }

  // 2) フォルダではないことが明確な URL（/file/d/...）
  if (FILE_URL_PATTERN.test(trimmed)) {
    return { ok: false, reason: 'NOT_A_FOLDER' };
  }

  // 3) /folders/{id} 系
  for (const pattern of FOLDER_URL_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]) return { ok: true, folderId: match[1] };
  }

  // 4) ?id={id} 系（open?id=...）
  for (const pattern of ID_QUERY_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match && match[1]) return { ok: true, folderId: match[1] };
  }

  return { ok: false, reason: 'INVALID_URL' };
}
