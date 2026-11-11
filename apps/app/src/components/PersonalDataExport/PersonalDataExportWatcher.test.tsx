// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../lib/i18n/dictionaries/en.json';
import { PersonalDataExportWatcher } from './PersonalDataExportWatcher';
import { usePersonalDataExportStore } from './personalDataExportStore';

type StatusQuery = {
  data?: { status: string; completedAt?: string };
  error: null;
  isFetched: boolean;
};

const { statusQuery, toastError, toastSuccess } = vi.hoisted(() => ({
  statusQuery: vi.fn<() => StatusQuery>(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/hooks/useFeatureFlag', () => ({ useFeatureFlag: () => true }));
vi.mock('@op/api/client', () => ({
  isTRPCClientError: () => false,
  trpc: {
    account: { getPersonalDataExportStatus: { useQuery: statusQuery } },
  },
}));
vi.mock('@op/sense/Toast', () => ({
  toast: { error: toastError, success: toastSuccess, close: vi.fn() },
}));
vi.mock('@op/logging/client', () => ({ logger: { error: vi.fn() } }));
vi.mock('./useDownloadPersonalDataExport', () => ({
  useDownloadPersonalDataExport: () => vi.fn(),
}));

const EXPORT_ID = '44444444-4444-4444-8444-444444444444';
const RESTORED_STARTED_AT = Date.now() - 31 * 60 * 1000;

const renderWatcher = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <PersonalDataExportWatcher />
    </NextIntlClientProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers();
  usePersonalDataExportStore.setState({
    state: {
      phase: 'running',
      exportId: EXPORT_ID,
      startedAt: RESTORED_STARTED_AT,
    },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('PersonalDataExportWatcher with a run restored past the wait cap', () => {
  it('does not report a failure before the first status read returns', () => {
    statusQuery.mockReturnValue({ error: null, isFetched: false });

    renderWatcher();
    act(() => {
      vi.runAllTimers();
    });

    expect(toastError).not.toHaveBeenCalled();
    expect(usePersonalDataExportStore.getState().state.phase).toBe('running');
  });

  it('offers the download when the run finished while the page was closed', () => {
    statusQuery.mockReturnValue({ error: null, isFetched: false });

    const { rerender } = renderWatcher();
    act(() => {
      vi.runAllTimers();
    });

    statusQuery.mockReturnValue({
      data: { status: 'completed', completedAt: new Date().toISOString() },
      error: null,
      isFetched: true,
    });
    rerender(
      <NextIntlClientProvider locale="en" messages={en}>
        <PersonalDataExportWatcher />
      </NextIntlClientProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled();
    expect(usePersonalDataExportStore.getState().state.phase).toBe('ready');
  });

  it('reports a failure once the status read shows the run is still going', () => {
    statusQuery.mockReturnValue({
      data: { status: 'processing' },
      error: null,
      isFetched: true,
    });

    renderWatcher();
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(toastError).toHaveBeenCalled();
    expect(usePersonalDataExportStore.getState().state.phase).toBe('idle');
  });
});
