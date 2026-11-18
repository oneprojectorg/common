// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CollabAccessDeniedError, useTiptapCollab } from './useTiptapCollab';

interface ProviderConfig {
  token: () => Promise<string>;
  onAuthenticationFailed: () => void;
  onDisconnect: () => void;
}

const { providers, toastError, loggerWarn } = vi.hoisted(() => ({
  providers: [] as Array<{
    config: ProviderConfig;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }>,
  toastError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@tiptap-pro/provider', () => ({
  TiptapCollabProvider: class {
    connect = vi.fn();
    disconnect = vi.fn();
    destroy = vi.fn();
    setAwarenessField = vi.fn();
    constructor(config: ProviderConfig) {
      providers.push({
        config,
        connect: this.connect,
        disconnect: this.disconnect,
      });
    }
  },
}));
vi.mock('@op/sense/Toast', () => ({ toast: { error: toastError } }));
vi.mock('@op/logging/client', () => ({
  logger: { warn: loggerWarn, error: vi.fn() },
}));
vi.mock('@op/styles/constants', () => ({
  getAvatarColorForString: () => ({ hex: '#000000' }),
}));

const t = (key: string) => key;
vi.mock('@/lib/i18n', () => ({ useTranslations: () => t }));

beforeEach(() => {
  providers.length = 0;
  toastError.mockClear();
  loggerWarn.mockClear();
  vi.stubEnv('NEXT_PUBLIC_TIPTAP_APP_ID', 'app-id');
});

function renderCollab(getToken: () => Promise<string>) {
  const hook = renderHook(() => useTiptapCollab({ docId: 'doc', getToken }));
  const provider = providers.at(-1);
  if (!provider) {
    throw new Error('Provider was not created');
  }
  return { ...hook, provider };
}

describe('useTiptapCollab', () => {
  it('stops reconnecting and reports access denied when the server refuses a token', async () => {
    const { result, provider } = renderCollab(() =>
      Promise.reject(new CollabAccessDeniedError('closed')),
    );

    await expect(provider.config.token()).rejects.toThrow('closed');
    act(() => provider.config.onAuthenticationFailed());
    act(() => provider.config.onDisconnect());

    expect(result.current.isAccessDenied).toBe(true);
    expect(provider.disconnect).toHaveBeenCalledTimes(1);
    expect(provider.connect).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    expect(loggerWarn).not.toHaveBeenCalled();
  });

  it('reconnects after an expired token and asks for a reload after repeated rejections', async () => {
    const { result, provider } = renderCollab(() => Promise.resolve('token'));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await provider.config.token();
      act(() => provider.config.onAuthenticationFailed());
      act(() => provider.config.onDisconnect());
    }

    expect(result.current.isAccessDenied).toBe(false);
    expect(provider.connect).toHaveBeenCalledTimes(2);
    expect(toastError).toHaveBeenCalledWith('reconnectError');
  });

  it('treats any other token request failure as a rejection to retry', async () => {
    const { result, provider } = renderCollab(() =>
      Promise.reject(new Error('network')),
    );

    await expect(provider.config.token()).rejects.toThrow('network');
    act(() => provider.config.onAuthenticationFailed());
    act(() => provider.config.onDisconnect());

    expect(result.current.isAccessDenied).toBe(false);
    expect(provider.connect).toHaveBeenCalledTimes(1);
  });
});
