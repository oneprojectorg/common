// @vitest-environment jsdom
import { PhaseCard } from '@op/sense/PhaseCard';
import { cleanup, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

const EDITOR = '/decisions/community-fund/manage/phases/row-review';
const editLink = <a href={EDITOR} />;

const renderCard = (props: Partial<ComponentProps<typeof PhaseCard>>) =>
  render(
    <PhaseCard
      state="upcoming"
      name="Review"
      startDate="2026-06-15"
      endDate="2026-06-28"
      locale="en"
      {...props}
    />,
  );

afterEach(cleanup);

describe('PhaseCard', () => {
  it('links the resting current card to its href', () => {
    renderCard({ state: 'current', href: '/current' });

    expect(
      screen.getByRole('link', { name: /Review/ }).getAttribute('href'),
    ).toBe('/current');
  });

  it('ignores the setup props at rest', () => {
    renderCard({ needsSetup: true, blurb: 'Collect ideas' });

    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByText('Collect ideas')).toBeNull();
  });

  it('links the whole card to the editor when the phase is ready', () => {
    renderCard({ editLink });

    const card = screen.getByRole('link', { name: /Review/ });
    expect(card.getAttribute('href')).toBe(EDITOR);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('names the ready card from its status, name and dates', () => {
    renderCard({
      state: 'current',
      editLink,
      isNowOpen: true,
      nowOpenLabel: 'Open now',
    });

    expect(
      screen.getByRole('link', { name: /^Open now\s*Review\s*Jun 15.*Jun 28/ }),
    ).toBeTruthy();
  });

  it('offers a Setup link and the blurb when the phase needs setup', () => {
    renderCard({
      editLink,
      needsSetup: true,
      setupLabel: 'Configure',
      blurb: 'Collect ideas',
    });

    const setup = screen.getByRole('link', { name: 'Configure Review' });
    expect(setup.getAttribute('href')).toBe(EDITOR);
    expect(screen.getByText('Collect ideas')).toBeTruthy();
    expect(screen.queryByText(/Jun/)).toBeNull();
  });

  it('gives the lead setup card the primary link', () => {
    renderCard({ editLink, needsSetup: true, isLead: true });

    expect(
      screen.getByRole('link', { name: 'Setup Review' }).className,
    ).toContain('bg-primary');
  });

  it('gives the other setup cards the outline link', () => {
    renderCard({ editLink, needsSetup: true });

    expect(
      screen.getByRole('link', { name: 'Setup Review' }).className,
    ).toContain('border-input');
  });

  it('never asks the current phase for setup', () => {
    renderCard({
      state: 'current',
      editLink,
      needsSetup: true,
    });

    expect(screen.queryByText('Setup')).toBeNull();
    expect(screen.getByRole('link', { name: /Review.*Jun/ })).toBeTruthy();
  });
});
