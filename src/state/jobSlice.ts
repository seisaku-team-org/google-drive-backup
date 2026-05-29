import type { CopyJob, CopyJobItem, CopyJobStatus, ProgressSnapshot } from '../types';

export type JobState = {
  currentJob: CopyJob | null;
  jobItems: CopyJobItem[];
  progress: ProgressSnapshot | null;
};

export const initialJobState: JobState = {
  currentJob: null,
  jobItems: [],
  progress: null,
};

export type JobAction =
  | { type: 'job/started'; payload: CopyJob }
  | {
      type: 'job/destinationCreated';
      payload: { destinationFolderId: string; destinationName: string };
    }
  | { type: 'job/itemAdded'; payload: CopyJobItem }
  | { type: 'job/itemUpdated'; payload: { itemId: string; updates: Partial<CopyJobItem> } }
  | { type: 'job/progressUpdated'; payload: ProgressSnapshot }
  | { type: 'job/cancelRequested' }
  | { type: 'job/statusChanged'; payload: { status: CopyJobStatus } }
  | { type: 'job/finished'; payload: { status: CopyJobStatus; finishedAt: number } }
  | { type: 'job/reset' };

export function jobReducer(state: JobState, action: JobAction): JobState {
  switch (action.type) {
    case 'job/started':
      return {
        currentJob: action.payload,
        jobItems: [],
        progress: {
          phase: 'counting',
          total: 0,
          done: 0,
          currentItemName: null,
          successCount: 0,
          skipCount: 0,
          abortedCount: 0,
        },
      };

    case 'job/destinationCreated':
      if (!state.currentJob) return state;
      return {
        ...state,
        currentJob: {
          ...state.currentJob,
          destinationFolderId: action.payload.destinationFolderId,
          destinationName: action.payload.destinationName,
        },
      };

    case 'job/itemAdded':
      return { ...state, jobItems: [...state.jobItems, action.payload] };

    case 'job/itemUpdated': {
      const { itemId, updates } = action.payload;
      return {
        ...state,
        jobItems: state.jobItems.map((it) => (it.id === itemId ? { ...it, ...updates } : it)),
      };
    }

    case 'job/progressUpdated':
      return { ...state, progress: action.payload };

    case 'job/cancelRequested':
      if (!state.currentJob) return state;
      return {
        ...state,
        currentJob: { ...state.currentJob, cancelRequested: true, status: 'cancelling' },
      };

    case 'job/statusChanged':
      if (!state.currentJob) return state;
      return {
        ...state,
        currentJob: { ...state.currentJob, status: action.payload.status },
      };

    case 'job/finished':
      if (!state.currentJob) return state;
      return {
        ...state,
        currentJob: {
          ...state.currentJob,
          status: action.payload.status,
          finishedAt: action.payload.finishedAt,
        },
      };

    case 'job/reset':
      return initialJobState;

    default:
      return state;
  }
}
