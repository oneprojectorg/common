// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import en from '../../../lib/i18n/dictionaries/en.json';
import { CopyEmailButton } from './CopyEmailButton';

const writeText = vi.fn(() => Promise.resolve());

const renderButton = () =>
  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <CopyEmailButton email="team@example.org" />
    </NextIntlClientProvider>,
  );

describe('CopyEmailButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    writeText.mockClear();
  });

  it('copies the email and reads "Copied" until the confirmation times out', async () => {
    renderButton();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(writeText).toHaveBeenCalledWith('team@example.org');
    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });

  it('keeps reading "Copy" when the clipboard write fails', async () => {
    writeText.mockImplementationOnce(() => Promise.reject(new Error('denied')));
    renderButton();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
  });
});
