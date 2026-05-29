import { describe, it, expect } from 'vitest';
import { uiReducer, initialUIState } from '../../src/state/uiSlice';
import type { FolderMetadata } from '../../src/types';

const folder: FolderMetadata = {
  id: 'f1',
  name: 'XXX',
  parents: ['root'],
  pathDisplay: 'マイドライブ / XXX',
  itemCount: 5,
  isInSharedDrive: false,
  destinationParentId: 'root',
  canDuplicateHere: true,
};

describe('uiReducer', () => {
  it('folderInputChanged で値が入る', () => {
    const next = uiReducer(initialUIState, {
      type: 'ui/folderInputChanged',
      payload: { value: 'https://...' },
    });
    expect(next.folderInput).toBe('https://...');
  });

  it('folderInputCleared で input・preview・error をすべて空にする', () => {
    const dirty = {
      ...initialUIState,
      folderInput: 'x',
      folderPreview: folder,
      folderPreviewError: 'e',
      folderPreviewLoading: true,
    };
    const next = uiReducer(dirty, { type: 'ui/folderInputCleared' });
    expect(next.folderInput).toBe('');
    expect(next.folderPreview).toBeNull();
    expect(next.folderPreviewError).toBeNull();
    expect(next.folderPreviewLoading).toBe(false);
  });

  it('folderPreviewFetching で loading=true、preview/error がクリアされる', () => {
    const dirty = {
      ...initialUIState,
      folderPreview: folder,
      folderPreviewError: 'old',
    };
    const next = uiReducer(dirty, { type: 'ui/folderPreviewFetching' });
    expect(next.folderPreviewLoading).toBe(true);
    expect(next.folderPreview).toBeNull();
    expect(next.folderPreviewError).toBeNull();
  });

  it('folderPreviewSucceeded で preview がセットされ loading=false', () => {
    const next = uiReducer(
      { ...initialUIState, folderPreviewLoading: true },
      { type: 'ui/folderPreviewSucceeded', payload: folder },
    );
    expect(next.folderPreview).toEqual(folder);
    expect(next.folderPreviewLoading).toBe(false);
  });

  it('folderPreviewFailed で error がセットされ loading=false、preview は null', () => {
    const next = uiReducer(
      { ...initialUIState, folderPreviewLoading: true },
      { type: 'ui/folderPreviewFailed', payload: { message: 'INVALID_URL' } },
    );
    expect(next.folderPreviewError).toBe('INVALID_URL');
    expect(next.folderPreviewLoading).toBe(false);
    expect(next.folderPreview).toBeNull();
  });

  it('toast を表示・解除できる', () => {
    let state = uiReducer(initialUIState, {
      type: 'ui/toastShown',
      payload: { id: 't1', message: 'hi', level: 'info' },
    });
    expect(state.toasts).toHaveLength(1);
    state = uiReducer(state, { type: 'ui/toastDismissed', payload: { id: 't1' } });
    expect(state.toasts).toHaveLength(0);
  });

  it('modal を開閉できる', () => {
    let state = uiReducer(initialUIState, {
      type: 'ui/modalOpened',
      payload: {
        kind: 'cancel-confirm',
        title: '複製を中止しますか？',
        body: '進行中の処理を中断します。',
        confirmLabel: '中止する',
        cancelLabel: '続行',
        confirmTone: 'danger',
      },
    });
    expect(state.modal?.kind).toBe('cancel-confirm');
    state = uiReducer(state, { type: 'ui/modalClosed' });
    expect(state.modal).toBeNull();
  });
});
