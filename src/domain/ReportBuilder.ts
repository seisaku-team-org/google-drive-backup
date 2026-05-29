/**
 * CopyJob と CopyJobItem[] から Report を組み立て、
 * プレーンテキスト形式にエクスポートする純粋関数。
 */

import type { CopyJob, CopyJobItem, Report } from '../types';

const DRIVE_FOLDER_URL_BASE = 'https://drive.google.com/drive/folders/';

export function buildReport(job: CopyJob, items: CopyJobItem[]): Report {
  const successCount = items.filter((i) => i.status === 'success').length;
  const skipCount = items.filter((i) => i.status === 'skipped').length;
  const abortedCount = items.filter((i) => i.status === 'aborted').length;
  const finishedAt = job.finishedAt ?? Date.now();
  const durationMs = Math.max(0, finishedAt - job.startedAt);
  const destinationUrl = job.destinationFolderId
    ? `${DRIVE_FOLDER_URL_BASE}${job.destinationFolderId}`
    : '';

  return {
    jobId: job.id,
    successCount,
    skipCount,
    abortedCount,
    durationMs,
    destinationUrl,
    destinationName: job.destinationName,
    skippedItems: items.filter((i) => i.status === 'skipped'),
    abortedItems: items.filter((i) => i.status === 'aborted'),
  };
}

/** 「レポートをコピー」用にプレーンテキストへ整形する */
export function toPlainText(report: Report): string {
  const lines: string[] = [];
  lines.push('Google Drive バックアップ — 複製レポート');
  lines.push('========================================');
  lines.push(`複製先名: ${report.destinationName}`);
  if (report.destinationUrl) lines.push(`複製先URL: ${report.destinationUrl}`);
  lines.push(`所要時間: ${formatDuration(report.durationMs)}`);
  lines.push(`成功: ${report.successCount} 件`);
  lines.push(`スキップ: ${report.skipCount} 件`);
  if (report.abortedCount > 0) lines.push(`中止: ${report.abortedCount} 件`);

  if (report.skippedItems.length > 0) {
    lines.push('');
    lines.push('--- スキップしたアイテム ---');
    for (const item of report.skippedItems) {
      lines.push(`  📄 ${item.sourceName}`);
      lines.push(`     所在: ${item.sourcePath}`);
      lines.push(`     理由: ${item.errorMessage ?? '(不明)'}`);
    }
  }

  if (report.abortedItems.length > 0) {
    lines.push('');
    lines.push('--- 中止により処理されなかったアイテム ---');
    for (const item of report.abortedItems) {
      lines.push(`  📄 ${item.sourceName}（${item.sourcePath}）`);
    }
  }

  return lines.join('\n');
}

/** ms を MM:SS 形式に。1 時間以上なら HH:MM:SS */
export function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
