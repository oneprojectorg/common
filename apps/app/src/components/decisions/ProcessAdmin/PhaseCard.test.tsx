// @vitest-environment jsdom
import { PhaseCard } from '@op/sense/PhaseCard';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('Collect ideas')).toBeNull();
  });

  it('opens the editor from the whole card when the phase is ready', async () => {
    const onOpen = vi.fn();
    renderCard({ onOpen, openLabel: 'Set up Review' });

    const card = screen.getByRole('button', { name: 'Set up Review' });
    expect(card.textContent).toContain('Review');
    expect(card.textContent).toMatch(/Jun/);

    await userEvent.setup().click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('tags a ready current card as open', () => {
    renderCard({
      state: 'current',
      onOpen: () => {},
      isNowOpen: true,
      nowOpenLabel: 'Open now',
    });

    expect(screen.getByText('Open now')).toBeTruthy();
  });

  it('offers a Setup button and the blurb when the phase needs setup', async () => {
    const onOpen = vi.fn();
    renderCard({
      onOpen,
      needsSetup: true,
      openLabel: 'Set up Review',
      setupLabel: 'Configure',
      blurb: 'Collect ideas',
    });

    const setup = screen.getByRole('button', { name: 'Set up Review' });
    expect(setup.textContent).toBe('Configure');
    expect(screen.getByText('Collect ideas')).toBeTruthy();
    expect(screen.queryByText(/Jun/)).toBeNull();

    await userEvent.setup().click(setup);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('gives the lead setup card the primary button', () => {
    renderCard({ onOpen: () => {}, needsSetup: true, isLead: true });

    expect(screen.getByRole('button', { name: 'Setup' }).className).toContain(
      'bg-primary',
    );
  });

  it('gives the other setup cards the outline button', () => {
    renderCard({ onOpen: () => {}, needsSetup: true });

    expect(screen.getByRole('button', { name: 'Setup' }).className).toContain(
      'border-input',
    );
  });

  it('never asks the current phase for setup', () => {
    renderCard({
      state: 'current',
      onOpen: () => {},
      needsSetup: true,
      openLabel: 'Set up Review',
    });

    expect(screen.queryByText('Setup')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Set up Review' }).textContent,
    ).toMatch(/Jun/);
  });
});
