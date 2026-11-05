// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../lib/i18n/dictionaries/en.json';
import { DecisionHeroBanner } from './DecisionHeroBanner';

// The upload field pulls in tRPC; the test only covers the admin gate.
vi.mock('./BannerUploadModal', () => ({ BannerUploadModal: () => null }));

const renderBanner = (isAdmin: boolean) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DecisionHeroBanner instanceId="instance" isAdmin={isAdmin}>
        <p>Hero</p>
      </DecisionHeroBanner>
    </NextIntlClientProvider>,
  );

describe('DecisionHeroBanner', () => {
  afterEach(cleanup);

  it('shows the Edit banner control to admins', () => {
    renderBanner(true);
    expect(screen.getByRole('button', { name: 'Edit banner' })).toBeTruthy();
  });

  it('hides the Edit banner control from non-admins', () => {
    renderBanner(false);
    expect(screen.queryByRole('button', { name: 'Edit banner' })).toBeNull();
  });
});
