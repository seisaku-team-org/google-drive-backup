import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../../tests/test-utils';
import { ReportView } from './ReportView';

describe('ReportView', () => {
  it('currentJob が無いと描画されない（ホームへリダイレクトされる）', () => {
    const { container } = renderWithProviders(<ReportView />, {
      initialEntries: ['/report'],
    });
    expect(container.querySelector('main')).toBeNull();
  });
});
