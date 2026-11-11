// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../../lib/i18n/dictionaries/en.json';
import { CustomFormFieldEditor } from './CustomFormFieldEditor';
import type { BuilderField, DraftProblem } from './formDefinition';
import { FORM_CHARACTER_LIMITS, createEmptyField } from './formDefinition';

const renderEditor = (initial: BuilderField, problems: DraftProblem[] = []) => {
  const onChange = vi.fn();
  const Harness = () => {
    const [field, setField] = useState(initial);
    return (
      <CustomFormFieldEditor
        field={field}
        index={0}
        total={1}
        problems={problems}
        onChange={(next) => {
          onChange(next);
          setField(next);
        }}
        onMove={() => {}}
        onRemove={() => {}}
      />
    );
  };

  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Harness />
    </NextIntlClientProvider>,
  );

  return { onChange, user: userEvent.setup() };
};

describe('CustomFormFieldEditor', () => {
  afterEach(cleanup);

  it('builds a grid from row and column inputs, and previews it as participants see it', async () => {
    const { onChange, user } = renderEditor({
      ...createEmptyField('grid'),
      kind: 'grid',
      title: 'How valuable?',
      options: ['1', '2'],
    });

    expect(screen.getByRole('group', { name: 'Columns' })).toBeTruthy();
    expect(screen.getByLabelText('Column 1')).toHaveProperty('value', '1');

    await user.click(screen.getByRole('button', { name: 'Add row' }));
    await user.keyboard('A trusted platform{Enter}A tool');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rows: [
          { localId: expect.any(String), title: 'A trusted platform' },
          { localId: expect.any(String), title: 'A tool' },
        ],
      }),
    );
    expect(screen.getByRole('region', { name: 'Preview' })).toBeTruthy();
    expect(
      screen
        .getAllByRole('radiogroup')
        .map((group) => group.getAttribute('aria-labelledby'))
        .map((id) => (id ? document.getElementById(id)?.textContent : null)),
    ).toEqual(['A trusted platform', 'A tool']);
  });

  it('keeps the key of a stored row when it is renamed or another row is removed', async () => {
    const { onChange, user } = renderEditor({
      ...createEmptyField('grid'),
      kind: 'grid',
      title: 'How valuable?',
      options: ['1', '2'],
      rows: [
        { localId: 'a', key: 'trustedPlatform', title: 'A trusted platform' },
        { localId: 'b', key: 'votingTool', title: 'A voting tool' },
      ],
    });

    await user.click(
      screen.getByRole('button', { name: 'Remove A trusted platform' }),
    );
    await user.type(screen.getByLabelText('Row 1'), 's');

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        rows: [{ localId: 'b', key: 'votingTool', title: 'A voting tools' }],
      }),
    );
  });

  it('stores options trimmed, without blanks or repeats', async () => {
    const { onChange, user } = renderEditor({
      ...createEmptyField('pick'),
      kind: 'dropdown',
      options: ['Yes'],
    });

    expect(screen.getByRole('group', { name: 'Options' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Rows' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add option' }));
    await user.keyboard(' Yes ');
    await user.click(screen.getByRole('button', { name: 'Add option' }));
    await user.keyboard('No');
    await user.click(screen.getByRole('button', { name: 'Add option' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ options: ['Yes', 'No'] }),
    );
  });

  it.each([
    ['only blank rows', ['1', '2'], [{ localId: 'a', title: '  ' }]],
    ['no columns', [], [{ localId: 'a', title: 'A tool' }]],
  ])('shows no preview for a grid with %s', (_case, options, rows) => {
    renderEditor({
      ...createEmptyField('grid'),
      kind: 'grid',
      title: 'How valuable?',
      options,
      rows,
    });

    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull();
  });

  it('adds an item on Enter only from the last filled input', async () => {
    const { user } = renderEditor({
      ...createEmptyField('pick'),
      kind: 'dropdown',
      options: ['Yes', 'No'],
    });

    await user.type(screen.getByLabelText('Option 1'), '{Enter}');
    expect(screen.queryByLabelText('Option 3')).toBeNull();

    await user.type(screen.getByLabelText('Option 2'), '{Enter}');
    expect(document.activeElement).toBe(screen.getByLabelText('Option 3'));

    await user.keyboard('{Enter}');
    expect(screen.queryByLabelText('Option 4')).toBeNull();
  });

  it('removes an option and moves focus to the one before it', async () => {
    const { onChange, user } = renderEditor({
      ...createEmptyField('pick'),
      kind: 'radio',
      options: ['Yes', 'No', 'Maybe'],
    });

    await user.click(screen.getByRole('button', { name: 'Remove No' }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ options: ['Yes', 'Maybe'] }),
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Option 1'));
  });

  it('marks only the row past the limit, and shows the message under the rows', () => {
    renderEditor(
      {
        ...createEmptyField('grid'),
        kind: 'grid',
        title: 'How valuable?',
        options: ['1'],
        rows: [
          {
            localId: 'long',
            title: 'a'.repeat(FORM_CHARACTER_LIMITS.gridRowTitle + 1),
          },
          { localId: 'short', title: 'A tool' },
        ],
      },
      [
        {
          code: 'grid-row-too-long',
          max: FORM_CHARACTER_LIMITS.gridRowTitle,
          fieldLocalId: 'grid',
        },
      ],
    );

    expect(screen.getByLabelText('Row 1').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(
      screen.getByLabelText('Row 2').getAttribute('aria-invalid'),
    ).not.toBe('true');
    expect(
      screen.getByText(
        `Use at most ${FORM_CHARACTER_LIMITS.gridRowTitle} characters.`,
      ),
    ).toBeTruthy();
  });
});
