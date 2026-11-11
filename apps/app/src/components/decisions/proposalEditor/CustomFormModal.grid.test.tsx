// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

import messages from '../../../lib/i18n/dictionaries/en.json';
import { CustomFormModal } from './CustomFormModal';

// The modal offers to translate the form; these tests never ask it to.
vi.mock('@op/api/client', () => ({
  trpc: {
    translation: {
      translateCustomForm: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
  },
}));

const COLUMNS = ['1', '2', '3'];

const gridSchema = ({ isRequired }: { isRequired: boolean }) => ({
  type: 'object',
  title: 'Exit survey',
  properties: {
    value: {
      type: 'object',
      title: 'How valuable would each be to your work?',
      'x-format': 'grid',
      properties: {
        trustedPlatform: {
          type: 'string',
          title: 'A trusted platform',
          enum: COLUMNS,
        },
        votingTool: {
          type: 'string',
          title: 'A tool that runs the vote',
          enum: COLUMNS,
        },
      },
      // Out of property order, so the test fails if rows ignore it.
      'x-field-order': ['votingTool', 'trustedPlatform'],
      required: isRequired ? ['trustedPlatform', 'votingTool'] : [],
    },
  },
  'x-field-order': ['value'],
  required: isRequired ? ['value'] : [],
});

const renderModal = (schema: Record<string, unknown>) => {
  const onSubmit = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CustomFormModal
        isOpen
        customFormId="form-1"
        schema={schema}
        onSubmit={onSubmit}
        onOpenChange={() => {}}
      />
    </NextIntlClientProvider>,
  );

  return { onSubmit, user: userEvent.setup() };
};

const row = (title: string) => screen.getByRole('radiogroup', { name: title });

describe('CustomFormModal grid field', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('draws one radio row per question, in the stored row order, with a radio per column', () => {
    renderModal(gridSchema({ isRequired: false }));

    expect(
      screen
        .getAllByRole('radiogroup')
        .map((group) => group.getAttribute('aria-labelledby'))
        .map((id) => (id ? document.getElementById(id)?.textContent : null)),
    ).toEqual(['A tool that runs the vote', 'A trusted platform']);
    expect(
      within(row('A trusted platform'))
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('aria-label')),
    ).toEqual(COLUMNS);
  });

  it('submits each row answer keyed by row, inside the grid field', async () => {
    const { onSubmit, user } = renderModal(gridSchema({ isRequired: true }));

    await user.click(
      within(row('A trusted platform')).getByRole('radio', { name: '2' }),
    );
    await user.click(
      within(row('A tool that runs the vote')).getByRole('radio', {
        name: '3',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith({
      value: { trustedPlatform: '2', votingTool: '3' },
    });
  });

  it('shows the error once, under the row a required grid is missing, until it is answered', async () => {
    const { onSubmit, user } = renderModal(gridSchema({ isRequired: true }));

    await user.click(
      within(row('A trusted platform')).getByRole('radio', { name: '1' }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(row('A tool that runs the vote').getAttribute('aria-invalid')).toBe(
      'true',
    );
    expect(row('A trusted platform').getAttribute('aria-invalid')).not.toBe(
      'true',
    );
    expect(
      screen.getAllByText('A tool that runs the vote is required'),
    ).toHaveLength(1);

    await user.click(
      within(row('A tool that runs the vote')).getByRole('radio', {
        name: '2',
      }),
    );

    expect(
      screen.queryByText('A tool that runs the vote is required'),
    ).toBeNull();
  });

  it('requires only the rows the grid lists as required', async () => {
    const schema = gridSchema({ isRequired: false });
    const { onSubmit, user } = renderModal({
      ...schema,
      properties: {
        value: { ...schema.properties.value, required: ['trustedPlatform'] },
      },
    });

    expect(row('A trusted platform').getAttribute('aria-required')).toBe(
      'true',
    );
    expect(
      row('A tool that runs the vote').getAttribute('aria-required'),
    ).not.toBe('true');

    await user.click(
      within(row('A tool that runs the vote')).getByRole('radio', {
        name: '1',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('A trusted platform is required')).toBeTruthy();

    await user.click(
      within(row('A trusted platform')).getByRole('radio', { name: '2' }),
    );
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith({
      value: { trustedPlatform: '2', votingTool: '1' },
    });
  });

  it('asks each row with a dropdown on a narrow screen', async () => {
    const matchMedia = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
      ...matchMedia(query),
      matches: true,
    }));
    const { onSubmit, user } = renderModal(gridSchema({ isRequired: true }));

    expect(screen.queryByRole('radiogroup')).toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('How valuable would each be to your work? is required'),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('combobox', { name: 'A trusted platform' }),
    );
    await user.click(await screen.findByRole('option', { name: '2' }));
    await user.click(
      screen.getByRole('combobox', { name: 'A tool that runs the vote' }),
    );
    await user.click(await screen.findByRole('option', { name: '3' }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith({
      value: { trustedPlatform: '2', votingTool: '3' },
    });
  });

  it.each([
    ['no rows', {}],
    ['no choices', { trustedPlatform: { type: 'string', title: 'Row' } }],
  ])(
    'skips a grid with %s, so it cannot block a submit',
    async (_case, rowProperties) => {
      const { onSubmit, user } = renderModal({
        ...gridSchema({ isRequired: true }),
        properties: {
          value: {
            type: 'object',
            title: 'How valuable would each be to your work?',
            'x-format': 'grid',
            properties: rowProperties,
            required: Object.keys(rowProperties),
          },
        },
      });

      expect(screen.queryByRole('group')).toBeNull();
      expect(screen.queryByRole('radiogroup')).toBeNull();

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onSubmit).toHaveBeenCalledWith({});
    },
  );

  it('submits nothing for an optional grid left blank', async () => {
    const { onSubmit, user } = renderModal(gridSchema({ isRequired: false }));

    await user.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith({});
  });
});

describe('CustomFormModal radio field', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const radioSchema = {
    type: 'object',
    title: 'Exit survey',
    properties: {
      wasAdmin: {
        type: 'string',
        title: 'Were you an admin?',
        'x-format': 'radio',
        enum: ['Yes', 'No'],
      },
    },
    'x-field-order': ['wasAdmin'],
    required: ['wasAdmin'],
  };

  it.each([
    ['a wide screen', false],
    ['a narrow screen, rather than a dropdown', true],
  ])(
    'offers each option as a labelled radio on %s, and submits the pick',
    async (_case, isNarrow) => {
      const matchMedia = window.matchMedia;
      vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
        ...matchMedia(query),
        matches: isNarrow,
      }));
      const { onSubmit, user } = renderModal(radioSchema);

      expect(screen.queryByRole('combobox')).toBeNull();
      const group = screen.getByRole('radiogroup');
      expect(within(group).getAllByRole('radio')).toHaveLength(2);
      expect(within(group).getByRole('radio', { name: 'Yes' })).toBeTruthy();

      await user.click(within(group).getByRole('radio', { name: 'No' }));
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onSubmit).toHaveBeenCalledWith({ wasAdmin: 'No' });
    },
  );
});
