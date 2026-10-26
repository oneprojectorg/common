// @vitest-environment jsdom
import { encodeErrorDigest } from '@op/core';
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import PageError from './index';

const renderPageError = (error: Error & { digest?: string }) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PageError error={error} />
    </NextIntlClientProvider>,
  );

const serverError = (digest: string) =>
  Object.assign(
    new Error('An error occurred in the Server Components render.'),
    {
      digest,
    },
  );

describe('PageError', () => {
  afterEach(cleanup);

  it('shows the forbidden screen for a server error that carries a 403', async () => {
    // Given the error a denied server render forwards to the browser
    const error = serverError(
      encodeErrorDigest({ statusCode: 403, name: 'UnauthorizedError' }),
    );

    // When the error boundary renders it
    renderPageError(error);

    // Then the user sees a 403, not the generic failure
    expect(await screen.findByText('403')).toBeTruthy();
    expect(screen.getByText(messages.shell.forbiddenTitle)).toBeTruthy();
    expect(
      screen.queryByText(messages.shell.errorTitle, { exact: false }),
    ).toBeNull();
  });

  it('shows the not-found screen for a server error that carries a 404', async () => {
    // Given the error a missing resource forwards to the browser
    const error = serverError(
      encodeErrorDigest({ statusCode: 404, name: 'NotFoundError' }),
    );

    // When the error boundary renders it
    renderPageError(error);

    // Then the user sees a 404
    expect(await screen.findByText('404')).toBeTruthy();
    expect(
      screen.getByText(messages.shell.notFoundTitle, { exact: false }),
    ).toBeTruthy();
  });

  it('shows the generic failure for an error without HTTP semantics', async () => {
    // Given an error whose digest Next.js generated itself
    const error = serverError('2732305804');

    // When the error boundary renders it
    renderPageError(error);

    // Then the user sees a 500
    expect(await screen.findByText('500')).toBeTruthy();
    expect(
      screen.getByText(messages.shell.errorTitle, { exact: false }),
    ).toBeTruthy();
  });
});
