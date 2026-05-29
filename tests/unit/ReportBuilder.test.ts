import { describe, it, expect } from 'vitest';
import { buildReport, toPlainText, formatDuration } from '../../src/domain/ReportBuilder';
import type { CopyJob, CopyJobItem } from '../../src/types';

const baseJob: CopyJob = {
  id: 'job-1',
  sourceFolderId: 'src-1',
  destinationFolderId: 'dst-1',
  destinationName: 'Copy of 大事な資料',
  status: 'completed',
  startedAt: 1_000_000,
  finishedAt: 1_134_000, // 134 sec = 02:14
  cancelRequested: false,
};

const items = (
  parts: Array<Partial<CopyJobItem> & { status: CopyJobItem['status'] }>,
): CopyJobItem[] =>
  parts.map(
    (p, i): CopyJobItem => ({
      id: `item-${i}`,
      jobId: 'job-1',
      sourceId: `src-item-${i}`,
      sourceName: `item-${i}.txt`,
      sourcePath: '/root',
      kind: 'file',
      errorMessage: null,
      ...p,
    }),
  );

describe('buildReport', () => {
  it('全件成功のケース', () => {
    const report = buildReport(
      baseJob,
      items([{ status: 'success' }, { status: 'success' }, { status: 'success' }]),
    );
    expect(report.successCount).toBe(3);
    expect(report.skipCount).toBe(0);
    expect(report.abortedCount).toBe(0);
    expect(report.skippedItems).toEqual([]);
    expect(report.abortedItems).toEqual([]);
    expect(report.durationMs).toBe(134_000);
    expect(report.destinationUrl).toBe('https://drive.google.com/drive/folders/dst-1');
    expect(report.destinationName).toBe('Copy of 大事な資料');
  });

  it('部分成功（スキップあり）のケース', () => {
    const report = buildReport(
      baseJob,
      items([
        { status: 'success' },
        { status: 'skipped', errorMessage: '403: insufficientPermissions' },
        { status: 'success' },
      ]),
    );
    expect(report.successCount).toBe(2);
    expect(report.skipCount).toBe(1);
    expect(report.skippedItems).toHaveLength(1);
    expect(report.skippedItems[0]?.errorMessage).toBe('403: insufficientPermissions');
  });

  it('中止ケース（aborted を含む）', () => {
    const cancelledJob: CopyJob = { ...baseJob, status: 'cancelled', cancelRequested: true };
    const report = buildReport(
      cancelledJob,
      items([{ status: 'success' }, { status: 'aborted' }, { status: 'aborted' }]),
    );
    expect(report.successCount).toBe(1);
    expect(report.abortedCount).toBe(2);
    expect(report.abortedItems).toHaveLength(2);
  });

  it('finishedAt が未設定なら現在時刻を使う', () => {
    const ongoingJob: CopyJob = { ...baseJob, finishedAt: null };
    const before = Date.now();
    const report = buildReport(ongoingJob, []);
    const after = Date.now();
    expect(report.durationMs).toBeGreaterThanOrEqual(before - baseJob.startedAt);
    expect(report.durationMs).toBeLessThanOrEqual(after - baseJob.startedAt);
  });

  it('destinationFolderId が null なら destinationUrl は空文字', () => {
    const noDestJob: CopyJob = { ...baseJob, destinationFolderId: null };
    const report = buildReport(noDestJob, []);
    expect(report.destinationUrl).toBe('');
  });
});

describe('toPlainText', () => {
  it('成功・スキップを含むレポートをプレーンテキスト化できる', () => {
    const report = buildReport(
      baseJob,
      items([
        { status: 'success' },
        {
          status: 'skipped',
          errorMessage: '403: クォータ超過',
          sourceName: '巨大ファイル.zip',
          sourcePath: '/root/添付',
        },
      ]),
    );
    const text = toPlainText(report);
    expect(text).toContain('Copy of 大事な資料');
    expect(text).toContain('https://drive.google.com/drive/folders/dst-1');
    expect(text).toContain('成功: 1 件');
    expect(text).toContain('スキップ: 1 件');
    expect(text).toContain('巨大ファイル.zip');
    expect(text).toContain('403: クォータ超過');
    expect(text).toContain('/root/添付');
  });

  it('aborted が 0 件なら中止セクションは出ない', () => {
    const report = buildReport(baseJob, items([{ status: 'success' }]));
    expect(toPlainText(report)).not.toContain('中止');
  });
});

describe('formatDuration', () => {
  it('1 時間未満は MM:SS', () => {
    expect(formatDuration(134_000)).toBe('02:14');
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(59_000)).toBe('00:59');
  });
  it('1 時間以上は HH:MM:SS', () => {
    expect(formatDuration(3_661_000)).toBe('01:01:01');
  });
});
