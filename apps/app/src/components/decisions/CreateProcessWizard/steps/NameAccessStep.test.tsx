// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import en from '@/lib/i18n/dictionaries/en.json';

import { NameAccessStep } from './NameAccessStep';

const renderStep = (name = '') => {
  const onNameChange = vi.fn();
  const onSubmit = vi.fn();

  render(
    <NextIntlClientProvider locale="en" messages={en}>
      <NameAccessStep
        name={name}
        onNameChange={onNameChange}
        onSubmit={onSubmit}
      />
    </NextIntlClientProvider>,
  );

  return {
    onNameChange,
    onSubmit,
    input: screen.getByLabelText('Process name'),
  };
};

const error = () => screen.queryByText(/Use at least/);

describe('NameAccessStep', () => {
  afterEach(cleanup);

  it('shows no error before the field is touched', () => {
    const { input } = renderStep();

    expect(error()).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('false');
    expect(input.getAttribute('aria-describedby')).toBeNull();
  });

  it('shows the error once a too-short name loses focus', async () => {
    const { input } = renderStep('ab');

    await userEvent.click(input);
    await userEvent.tab();

    expect(error()).not.toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('process-name-error');
  });

  it('shows the error on submit with an empty name', () => {
    const { input, onSubmit } = renderStep();

    fireEvent.submit(input.closest('form') as HTMLFormElement);

    expect(error()).not.toBeNull();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('keeps a long enough name error-free after blur', async () => {
    const { input } = renderStep('Neighborhood Grants');

    await userEvent.click(input);
    await userEvent.tab();

    expect(error()).toBeNull();
    expect(input.getAttribute('aria-invalid')).toBe('false');
  });

  it('hands every keystroke to the parent', async () => {
    const { input, onNameChange } = renderStep();

    await userEvent.type(input, 'ab');

    expect(onNameChange).toHaveBeenNthCalledWith(1, 'a');
    expect(onNameChange).toHaveBeenNthCalledWith(2, 'b');
  });
});
