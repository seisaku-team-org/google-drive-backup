import { describe, it, expect } from 'vitest';
import { jobReducer, initialJobState } from '../../src/state/jobSlice';
import type { CopyJob, CopyJobItem } from '../../src/types';

const baseJob: CopyJob = {
  id: 'job-1',
  sourceFolderId: 'src-1',
  destinationFolderId: null,
  destinationName: 'Copy of XXX',
  status: 'preparing',
  startedAt: 100,
  finishedAt: null,
  cancelRequested: false,
};

const baseItem: CopyJobItem = {
  id: 'i1',
  jobId: 'job-1',
  sourceId: 's1',
  sourceName: 'a.txt',
  sourcePath: '/',
  kind: 'file',
  status: 'pending',
  errorMessage: null,
};

describe('jobReducer', () => {
  it('job/started で current job をセットし items を空に初期化する', () => {
    const next = jobReducer(initialJobState, { type: 'job/started', payload: baseJob });
    expect(next.currentJob).toEqual(baseJob);
    expect(next.jobItems).toEqual([]);
    expect(next.progress).not.toBeNull();
  });

  it('job/destinationCreated で複製先 ID と名前を更新する', () => {
    const withJob = jobReducer(initialJobState, { type: 'job/started', payload: baseJob });
    const next = jobReducer(withJob, {
      type: 'job/destinationCreated',
      payload: { destinationFolderId: 'dst-1', destinationName: 'Copy of XXX (2)' },
    });
    expect(next.currentJob?.destinationFolderId).toBe('dst-1');
    expect(next.currentJob?.destinationName).toBe('Copy of XXX (2)');
  });

  it('job/itemAdded で items に追加される', () => {
    const withJob = jobReducer(initialJobState, { type: 'job/started', payload: baseJob });
    const next = jobReducer(withJob, { type: 'job/itemAdded', payload: baseItem });
    expect(next.jobItems).toHaveLength(1);
  });

  it('job/itemUpdated で対象 item だけが更新される', () => {
    let state = jobReducer(initialJobState, { type: 'job/started', payload: baseJob });
    state = jobReducer(state, { type: 'job/itemAdded', payload: baseItem });
    state = jobReducer(state, {
      type: 'job/itemAdded',
      payload: { ...baseItem, id: 'i2', sourceName: 'b.txt' },
    });
    const next = jobReducer(state, {
      type: 'job/itemUpdated',
      payload: { itemId: 'i2', updates: { status: 'success' } },
    });
    expect(next.jobItems[0]?.status).toBe('pending');
    expect(next.jobItems[1]?.status).toBe('success');
  });

  it('job/cancelRequested で cancelRequested=true & status=cancelling', () => {
    const withJob = jobReducer(initialJobState, {
      type: 'job/started',
      payload: { ...baseJob, status: 'running' },
    });
    const next = jobReducer(withJob, { type: 'job/cancelRequested' });
    expect(next.currentJob?.cancelRequested).toBe(true);
    expect(next.currentJob?.status).toBe('cancelling');
  });

  it('job/finished で status と finishedAt を確定する', () => {
    const withJob = jobReducer(initialJobState, { type: 'job/started', payload: baseJob });
    const next = jobReducer(withJob, {
      type: 'job/finished',
      payload: { status: 'completed', finishedAt: 5000 },
    });
    expect(next.currentJob?.status).toBe('completed');
    expect(next.currentJob?.finishedAt).toBe(5000);
  });

  it('job/reset で初期状態に戻る', () => {
    const withJob = jobReducer(initialJobState, { type: 'job/started', payload: baseJob });
    expect(jobReducer(withJob, { type: 'job/reset' })).toEqual(initialJobState);
  });
});
