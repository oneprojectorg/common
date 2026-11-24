// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminPhaseTimeline } from './ProcessAdminPhaseTimeline';

const SLUG = 'community-fund';

const submit = {
  id: 'row-submit',
  phaseId: 'submit',
  name: 'Submit',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-31T00:00:00.000Z',
  rules: { proposals: { submit: true } },
};
const vote = {
  id: 'row-vote',
  phaseId: 'vote',
  name: 'Vote',
  startDate: '2026-02-01T00:00:00.000Z',
};

const renderTimeline = (
  props: Partial<ComponentProps<typeof ProcessAdminPhaseTimeline>>,
) =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ProcessAdminPhaseTimeline
        slug={SLUG}
        phases={[submit, vote]}
        currentStateId={null}
        hasStarted
        {...props}
      />
    </NextIntlClientProvider>,
  );

afterEach(cleanup);

describe('ProcessAdminPhaseTimeline', () => {
  it('lists every phase in stored order', () => {
    renderTimeline({ currentStateId: 'vote' });

    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Submit'),
      expect.stringContaining('Vote'),
    ]);
  });

  it('links only the current phase, matched on its text key', () => {
    renderTimeline({ currentStateId: 'vote' });

    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: /Vote/ }).getAttribute('href'),
    ).toBe(`/decisions/${SLUG}/current`);
  });

  it('tags the current phase as open when it takes proposals', () => {
    renderTimeline({ currentStateId: 'submit' });

    expect(screen.getByText('Now open!')).toBeTruthy();
  });

  it('leaves the tag off a current phase that takes no proposals', () => {
    renderTimeline({ currentStateId: 'vote' });

    expect(screen.queryByText('Now open!')).toBeNull();
  });

  it('shows no current phase before the process starts', () => {
    renderTimeline({ currentStateId: 'submit', hasStarted: false });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Now open!')).toBeNull();
  });

  it('shows no current phase when the current key matches none', () => {
    renderTimeline({ currentStateId: 'results' });

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders phases that have no row id yet', () => {
    renderTimeline({
      phases: [submit, vote].map((phase) => ({ ...phase, id: null })),
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
