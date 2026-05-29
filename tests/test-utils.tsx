import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import type { ReactElement, ReactNode } from 'react';
import { AppProvider } from '../src/state/AppContext';
import { ServicesProvider, type Services } from '../src/services/ServicesContext';
import { createStubServices } from '../src/services/stubServices';

type Options = Omit<RenderOptions, 'wrapper'> & {
  initialEntries?: MemoryRouterProps['initialEntries'];
  services?: Services;
};

/**
 * AppProvider + ServicesProvider(stub) + MemoryRouter で wrap して render する共通ヘルパー。
 * 個別テストで services をオーバーライドできる。
 */
export function renderWithProviders(ui: ReactElement, options: Options = {}) {
  const { initialEntries = ['/'], services, ...rest } = options;
  const stubServices = services ?? createStubServices();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ServicesProvider services={stubServices}>
        <AppProvider>
          <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
        </AppProvider>
      </ServicesProvider>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}
