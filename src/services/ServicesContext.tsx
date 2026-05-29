import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AuthClient } from '../infra/AuthClient';
import type { DriveApiClient } from '../infra/DriveApiClient';
import type { CopyEngine } from '../domain/CopyEngine';
import { createRealServices } from './realServices';
import { createStubServices } from './stubServices';

export type Services = {
  authClient: AuthClient;
  driveApi: DriveApiClient;
  copyEngine: CopyEngine;
};

const ServicesContext = createContext<Services | null>(null);

export type ServicesProviderProps = {
  services?: Services;
  children: ReactNode;
};

/**
 * 環境変数 VITE_GOOGLE_CLIENT_ID が設定されていれば実サービスを、
 * 設定されていない場合はスタブサービスを既定で構築する。
 * テストや E2E では `services` プロパティで差し替える。
 */
export function ServicesProvider({ services, children }: ServicesProviderProps) {
  const value = useMemo<Services>(() => {
    if (services) return services;
    // Playwright が addInitScript で window.__USE_STUB__ をセットしている場合はスタブを使う
    if (typeof window !== 'undefined' && (window as WindowWithStub).__USE_STUB__) {
      return createStubServices();
    }
    try {
      return createRealServices();
    } catch (err) {
      console.warn(
        '[services] VITE_GOOGLE_CLIENT_ID が未設定のためスタブサービスで起動します:',
        err instanceof Error ? err.message : err,
      );
      return createStubServices();
    }
  }, [services]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

type WindowWithStub = Window & { __USE_STUB__?: boolean };

export function useServices(): Services {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error('useServices must be used within <ServicesProvider>');
  return ctx;
}
