// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DecisionStat, DecisionStats } from './DecisionStats';

const renderStats = () =>
  render(
    <DecisionStats>
      <DecisionStat value="5/7" label="Participants voted" />
      <DecisionStat value="71%" label="Turnout" />
      <DecisionStat value="7" label="Days left" />
    </DecisionStats>,
  );

const statOf = (label: string) => screen.getByText(label).parentElement;

describe('DecisionStats', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hides only the first divider when the stats fit on one line', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(0);
    renderStats();

    expect(statOf('Participants voted')?.hasAttribute('data-line-start')).toBe(
      true,
    );
    expect(statOf('Turnout')?.hasAttribute('data-line-start')).toBe(false);
    expect(statOf('Days left')?.hasAttribute('data-line-start')).toBe(false);
  });

  it('hides the divider of a stat that wraps to a new line', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
      function (this: HTMLElement) {
        return this.textContent?.includes('Days left') ? 80 : 0;
      },
    );
    renderStats();

    expect(statOf('Turnout')?.hasAttribute('data-line-start')).toBe(false);
    expect(statOf('Days left')?.hasAttribute('data-line-start')).toBe(true);
  });
});
