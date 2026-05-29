/**
 * 共有 URL からの自動取得時に、UI 表示用 FolderMetadata を組み立てる。
 * 機能設計書 §4.2 のプレビュー取得処理に対応。
 *
 * 仕様：
 *   1. driveApi.getFolder で元フォルダを取得（共有ドライブなら getFolder が throw）
 *   2. parents[0]（無ければ 'root'）を destinationParentId とする
 *   3. destinationParentId !== 'root' なら親フォルダの capabilities を再取得して
 *      canAddChildren を canDuplicateHere に反映
 *   4. 直下のアイテム数は listChildren 1 ページ (pageSize=200) で概算
 */

import type { DriveApiClient } from '../infra/DriveApiClient';
import type { FolderMetadata } from '../types';

const ROOT = 'root';

export type FetchFolderPreviewOptions = {
  signal?: AbortSignal;
};

export async function fetchFolderPreview(
  driveApi: DriveApiClient,
  folderId: string,
  options: FetchFolderPreviewOptions = {},
): Promise<FolderMetadata> {
  const src = await driveApi.getFolder(folderId, { signal: options.signal });
  const destinationParentId =
    src.parents && src.parents.length > 0 ? (src.parents[0] ?? ROOT) : ROOT;

  // 親階層書き込み権限の確認
  let canDuplicateHere = true;
  let parentName = 'マイドライブ';
  if (destinationParentId !== ROOT) {
    const parent = await driveApi.getFolder(destinationParentId, {
      fields: 'id,name,capabilities',
      signal: options.signal,
    });
    canDuplicateHere = parent.capabilities?.canAddChildren === true;
    parentName = parent.name;
  }

  // 直下のアイテム数（1 ページの概算）
  const list = await driveApi.listChildren(folderId, {
    pageSize: 200,
    fields: 'files(id),nextPageToken',
    signal: options.signal,
  });
  const itemCount = list.nextPageToken ? list.files.length : list.files.length;
  // ※ nextPageToken があれば「200+」だが UI 側で文言を出すための情報はここでは保持しない

  return {
    id: src.id,
    name: src.name,
    parents: src.parents ?? [],
    pathDisplay:
      destinationParentId === ROOT ? `マイドライブ / ${src.name}` : `${parentName} / ${src.name}`,
    itemCount,
    isInSharedDrive: false, // driveApi.getFolder が driveId 検出時に throw するため、ここでは常に false
    destinationParentId,
    canDuplicateHere,
  };
}
