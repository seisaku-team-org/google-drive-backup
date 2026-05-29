import type { FolderMetadata } from '../types';

export type ToastLevel = 'info' | 'warn' | 'error';

export type ToastItem = {
  id: string;
  message: string;
  level: ToastLevel;
};

export type ModalSpec = {
  /** モーダル識別キー（例: 'cancel-confirm' / 'logout-confirm'）*/
  kind: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  /** danger は破壊的アクション色（赤系）*/
  confirmTone?: 'primary' | 'danger';
};

export type UIState = {
  folderInput: string;
  folderPreview: FolderMetadata | null;
  folderPreviewError: string | null;
  folderPreviewLoading: boolean;
  toasts: ToastItem[];
  modal: ModalSpec | null;
};

export const initialUIState: UIState = {
  folderInput: '',
  folderPreview: null,
  folderPreviewError: null,
  folderPreviewLoading: false,
  toasts: [],
  modal: null,
};

export type UIAction =
  | { type: 'ui/folderInputChanged'; payload: { value: string } }
  | { type: 'ui/folderInputCleared' }
  | { type: 'ui/folderPreviewFetching' }
  | { type: 'ui/folderPreviewSucceeded'; payload: FolderMetadata }
  | { type: 'ui/folderPreviewFailed'; payload: { message: string } }
  | { type: 'ui/toastShown'; payload: ToastItem }
  | { type: 'ui/toastDismissed'; payload: { id: string } }
  | { type: 'ui/modalOpened'; payload: ModalSpec }
  | { type: 'ui/modalClosed' };

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'ui/folderInputChanged':
      return { ...state, folderInput: action.payload.value };

    case 'ui/folderInputCleared':
      return {
        ...state,
        folderInput: '',
        folderPreview: null,
        folderPreviewError: null,
        folderPreviewLoading: false,
      };

    case 'ui/folderPreviewFetching':
      return {
        ...state,
        folderPreview: null,
        folderPreviewError: null,
        folderPreviewLoading: true,
      };

    case 'ui/folderPreviewSucceeded':
      return {
        ...state,
        folderPreview: action.payload,
        folderPreviewError: null,
        folderPreviewLoading: false,
      };

    case 'ui/folderPreviewFailed':
      return {
        ...state,
        folderPreview: null,
        folderPreviewError: action.payload.message,
        folderPreviewLoading: false,
      };

    case 'ui/toastShown':
      return { ...state, toasts: [...state.toasts, action.payload] };

    case 'ui/toastDismissed':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.payload.id) };

    case 'ui/modalOpened':
      return { ...state, modal: action.payload };

    case 'ui/modalClosed':
      return { ...state, modal: null };

    default:
      return state;
  }
}
