// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ErrorBoundary from './ErrorBoundary';

const { captureException, loggerInfo, FakeTRPCClientError } = vi.hoisted(
  () => ({
    captureException: vi.fn(),
    loggerInfo: vi.fn(),
    FakeTRPCClientError: class extends Error {
      constructor(
        message: string,
        public readonly data: { httpStatus: number },
      ) {
        super(message);
      }
    },
  }),
);

vi.mock('posthog-js', () => ({ default: { captureException } }));
vi.mock('@op/logging/client', () => ({ logger: { info: loggerInfo } }));
vi.mock('@op/api/client', () => ({
  isTRPCClientError: (error: unknown) => error instanceof FakeTRPCClientError,
}));

const Thrower = ({ error }: { error: Error }): never => {
  throw error;
};

const renderWithError = (error: Error) =>
  render(
    <ErrorBoundary fallback={<p>fallback</p>}>
      <Thrower error={error} />
    </ErrorBoundary>,
  );

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React and the boundary both report the caught error to the console.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('shows the fallback for a 401 and does not report it', () => {
    renderWithError(
      new FakeTRPCClientError('You need to sign in to access this resource.', {
        httpStatus: 401,
      }),
    );

    expect(screen.getByText('fallback')).toBeTruthy();
    expect(captureException).not.toHaveBeenCalled();
    expect(loggerInfo).toHaveBeenCalledOnce();
  });

  it('reports a 403 to Error Tracking', () => {
    const error = new FakeTRPCClientError('Forbidden', { httpStatus: 403 });

    renderWithError(error);

    expect(screen.getByText('fallback')).toBeTruthy();
    expect(captureException).toHaveBeenCalledWith(error, expect.anything());
  });

  it('reports an error that is not from tRPC', () => {
    const error = new Error('boom');

    renderWithError(error);

    expect(captureException).toHaveBeenCalledWith(error, expect.anything());
  });
});
