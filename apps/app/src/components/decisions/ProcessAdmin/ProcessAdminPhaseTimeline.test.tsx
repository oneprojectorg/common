// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { ProcessAdminPhaseTimeline } from './ProcessAdminPhaseTimeline';

// The i18n Link prefetches through the app router, which a unit test has none of.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ prefetch: () => {}, push: () => {}, refresh: () => {} }),
  usePathname: () => '/',
}));
vi.mock('@/hooks/useForesight', () => ({
  useForesight: () => ({ elementRef: { current: null } }),
}));

const SLUG = 'community-fund';

const submit = {
  id: 'row-submit',
  slug: 'a1b2c3d4',
  phaseId: 'submit',
  name: 'Submit',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: '2026-01-31T00:00:00.000Z',
  rules: { proposals: { submit: true } },
};
const vote = {
  id: 'row-vote',
  slug: 'e5f6a7b8',
  phaseId: 'vote',
  name: 'Vote',
  startDate: '2026-02-01T00:00:00.000Z',
  endDate: '2026-02-28T00:00:00.000Z',
  rules: { voting: { submit: true } },
};

const editorHref = (phaseSlug: string) =>
  `/en/decisions/${SLUG}/manage/phase/${phaseSlug}`;

const templates = {
  proposalTemplate: { type: 'object', properties: { summary: {} } },
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
        templates={templates}
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

  it('links every phase to its editor while editing', () => {
    renderTimeline({ currentStateId: 'vote', isEditing: true });

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      editorHref('a1b2c3d4'),
      editorHref('e5f6a7b8'),
    ]);
  });

  it('links every phase to its editor on a draft that has not started', () => {
    renderTimeline({
      currentStateId: 'submit',
      hasStarted: false,
      isEditing: true,
    });

    expect(
      screen.getAllByRole('link').map((link) => link.getAttribute('href')),
    ).toEqual([editorHref('a1b2c3d4'), editorHref('e5f6a7b8')]);
  });

  it('links the current phase to its editor instead of the current page while editing', () => {
    renderTimeline({ currentStateId: 'vote', isEditing: true });

    expect(
      screen.getByRole('link', { name: /Vote/ }).getAttribute('href'),
    ).toBe(editorHref('e5f6a7b8'));
  });

  it('names each editor link from the phase it shows', () => {
    renderTimeline({ currentStateId: 'vote', isEditing: true });

    expect(screen.getByRole('link', { name: /^Submit.+ - .+$/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Vote.+$/ })).toBeTruthy();
  });

  it('asks for setup on a phase without both dates, at rest too', () => {
    renderTimeline({
      currentStateId: 'submit',
      phases: [submit, { ...vote, endDate: undefined }],
    });

    expect(
      screen.getByRole('link', { name: 'Setup Vote' }).getAttribute('href'),
    ).toBe(editorHref('e5f6a7b8'));
    expect(screen.getByText('People decide between them')).toBeTruthy();
  });

  it('asks for setup on a collecting phase with no form of its own or from the decision', () => {
    renderTimeline({ currentStateId: 'vote', templates: {} });

    expect(screen.getByRole('link', { name: 'Setup Submit' })).toBeTruthy();
    expect(screen.getByText('People send in proposals')).toBeTruthy();
  });

  it('never asks the current phase for setup', () => {
    renderTimeline({ currentStateId: 'submit', templates: {} });

    expect(screen.queryByRole('link', { name: /^Setup/ })).toBeNull();
  });

  it('gives a phase with no row yet no editor link, even when it needs setup', () => {
    renderTimeline({
      isEditing: true,
      templates: {},
      phases: [submit, vote].map((phase) => ({
        ...phase,
        id: null,
        slug: null,
      })),
    });

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('renders phases that have no row id yet', () => {
    renderTimeline({
      phases: [submit, vote].map((phase) => ({
        ...phase,
        id: null,
        slug: null,
      })),
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});
