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
    renderCard({ editLink, openLabel: 'Set up Review' });

    const card = screen.getByRole('link', { name: 'Set up Review' });
    expect(card.getAttribute('href')).toBe(EDITOR);
    expect(card.textContent).toContain('Review');
    expect(card.textContent).toMatch(/Jun/);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('tags a ready current card as open', () => {
    renderCard({
      state: 'current',
      editLink,
      isNowOpen: true,
      nowOpenLabel: 'Open now',
    });

    expect(screen.getByText('Open now')).toBeTruthy();
  });

  it('offers a Setup link and the blurb when the phase needs setup', () => {
    renderCard({
      editLink,
      needsSetup: true,
      openLabel: 'Set up Review',
      setupLabel: 'Configure',
      blurb: 'Collect ideas',
    });

    const setup = screen.getByRole('link', { name: 'Set up Review' });
    expect(setup.getAttribute('href')).toBe(EDITOR);
    expect(setup.textContent).toBe('Configure');
    expect(screen.getByText('Collect ideas')).toBeTruthy();
    expect(screen.queryByText(/Jun/)).toBeNull();
  });

  it('gives the lead setup card the primary link', () => {
    renderCard({ editLink, needsSetup: true, isLead: true });

    expect(screen.getByRole('link', { name: 'Setup' }).className).toContain(
      'bg-primary',
    );
  });

  it('gives the other setup cards the outline link', () => {
    renderCard({ editLink, needsSetup: true });

    expect(screen.getByRole('link', { name: 'Setup' }).className).toContain(
      'border-input',
    );
  });

  it('never asks the current phase for setup', () => {
    renderCard({
      state: 'current',
      editLink,
      needsSetup: true,
      openLabel: 'Set up Review',
    });

    expect(screen.queryByText('Setup')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Set up Review' }).textContent,
    ).toMatch(/Jun/);
  });
});
