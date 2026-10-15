import { EditableText, type EditableTextProps } from '@op/sense/EditableText';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  expect,
  fireEvent,
  fn,
  userEvent,
  waitFor,
  within,
} from 'storybook/test';

const LONG_TITLE =
  'Participatory budgeting for neighbourhood infrastructure, parks and libraries across the eastern district';

// Every story commits for real, so a hand edit shows on screen and
// `args.onCommit` records the call.
const meta: Meta<typeof EditableText> = {
  title: 'Composites/EditableText',
  component: EditableText,
  tags: ['autodocs'],
  args: {
    value: 'Community fund 2027',
    onCommit: fn(),
    label: 'Process name',
    as: 'h2',
    className: 'font-serif text-headline font-light',
    iconClassName: 'size-5',
  },
  render: (args) => <Interactive {...args} />,
};

export default meta;

type Story = StoryObj<typeof EditableText>;

const narrow: Story['decorators'] = [
  (Story) => (
    <div className="w-96">
      <Story />
    </div>
  ),
];

// Click the title, or Tab to its button and press Enter. The text is selected
// on entry, and the pencil becomes a check: Enter, the check or clicking away
// commits, Escape reverts, a blank value reverts.
export const Default: Story = {};

// One line at rest: a long title truncates, and the full text stays in the
// field and in the accessibility tree.
export const LongText: Story = {
  args: { value: LONG_TITLE },
  decorators: narrow,
};

// `wrap`: the same long title runs onto more lines instead of truncating, with
// the button on the first line. It is still one line of text: Enter commits,
// and the field grows with the draft while editing.
export const Wrap: Story = {
  args: { value: LONG_TITLE, wrap: true },
  decorators: narrow,
};

// Arabic on an Arabic page, and English on an Arabic page: the title takes its
// direction from its text (`dir="auto"`) with alignment pinned to the page, and
// the field picks its direction from the text being typed.
export const RightToLeft: Story = {
  args: { label: 'اسم العملية' },
  render: (args) => (
    <div dir="rtl" className="flex w-96 flex-col gap-4">
      <Interactive {...args} value="ميزانية ٢٠٢٧" />
      <Interactive {...args} value="Community fund 2027?" />
    </div>
  ),
};

// No title yet: the placeholder shows muted at rest and in the empty field.
export const Empty: Story = {
  args: { value: '', placeholder: 'Untitled process' },
};

// No title and no placeholder: the label stands in, so the button keeps a name.
export const EmptyWithoutPlaceholder: Story = {
  args: { value: '' },
};

// Plain text: no button, nothing in the tab order.
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole('button')).not.toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: 'Community fund 2027' }),
    ).toBeInTheDocument();
  },
};

// The text takes its type from the box, so the caller styles it with
// `className`; the field keeps the same metrics while editing. `as` sets the
// element, and `iconClassName` sizes the icon.
export const Styled: Story = {
  render: (args) => (
    <div className="flex flex-col gap-4">
      <Interactive
        {...args}
        as="h1"
        className="font-serif text-display font-light"
        iconClassName="size-6"
        value="Display, serif"
      />
      <Interactive
        {...args}
        as="h2"
        className="font-serif text-headline font-light"
        iconClassName="size-5"
        value="Headline, serif"
      />
      <Interactive
        {...args}
        as="h3"
        className="font-sans text-title font-strong"
        value="Title, sans"
      />
      <Interactive
        {...args}
        as="p"
        className="text-label text-muted-foreground"
        iconClassName="size-3.5"
        value="Label, muted"
      />
    </div>
  ),
};

// onCommit fires only for a real change: blank, unchanged and Escape do not
// reach it. The log below is a live region so each commit is announced.
export const Controlled: Story = {
  render: (args) => <CommitLog {...args} />,
};

// Interaction checks. They run in the Interactions panel; nothing runs them in
// CI until the @storybook/addon-vitest gate lands (see README.md).

// The button is named by the hint and the title; entering selects all; Enter
// commits the trimmed value once and hands focus back to the button, now named
// by the new text.
export const CommitsOnEnter: Story = {
  args: { onCommit: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Edit Community fund 2027' }),
    );
    const field = canvas.getByRole<HTMLInputElement>('textbox', {
      name: 'Process name',
    });
    await expect(field).toHaveFocus();
    await expect(field.selectionStart).toBe(0);
    await expect(field.selectionEnd).toBe('Community fund 2027'.length);

    await userEvent.clear(field);
    await userEvent.type(field, '  Budget 2028  {Enter}');
    await expect(args.onCommit).toHaveBeenCalledTimes(1);
    await expect(args.onCommit).toHaveBeenCalledWith('Budget 2028');
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Edit Budget 2028' }),
      ).toHaveFocus(),
    );
  },
};

// The same button commits while editing: Tab reaches it without committing,
// and clicking it commits once.
export const CommitsOnDone: Story = {
  args: { onCommit: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    const field = canvas.getByRole('textbox');
    await userEvent.clear(field);
    await userEvent.type(field, 'Budget 2028');

    await userEvent.tab();
    const done = canvas.getByRole('button', { name: 'Done' });
    await expect(done).toHaveFocus();
    await expect(args.onCommit).not.toHaveBeenCalled();

    await userEvent.click(done);
    await expect(args.onCommit).toHaveBeenCalledTimes(1);
    await expect(args.onCommit).toHaveBeenCalledWith('Budget 2028');
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Edit Budget 2028' }),
      ).toHaveFocus(),
    );
  },
};

// Escape reverts and hands focus back to the button.
export const RevertsOnEscape: Story = {
  args: { onCommit: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    const field = canvas.getByRole('textbox');
    await userEvent.type(field, 'Something else{Escape}');

    await expect(args.onCommit).not.toHaveBeenCalled();
    const trigger = canvas.getByRole('button', {
      name: 'Edit Community fund 2027',
    });
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

// Blank and unchanged values do not reach onCommit.
export const SkipsBlankAndUnchanged: Story = {
  args: { value: '  Community fund 2027 ', onCommit: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button'));
    await userEvent.clear(canvas.getByRole('textbox'));
    await userEvent.keyboard('   {Enter}');

    await userEvent.click(canvas.getByRole('button'));
    await userEvent.clear(canvas.getByRole('textbox'));
    await userEvent.keyboard('Community fund 2027{Enter}');

    await expect(args.onCommit).not.toHaveBeenCalled();
  },
};

// Enter and Escape while an IME is composing leave the edit open; pasted line
// breaks become spaces.
export const CompositionAndPaste: Story = {
  args: { onCommit: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    const field = canvas.getByRole('textbox');

    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(field, { key: 'Escape', isComposing: true });
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
    await expect(canvas.getByRole('textbox')).toBeInTheDocument();
    await expect(args.onCommit).not.toHaveBeenCalled();

    await userEvent.clear(field);
    await userEvent.paste('Budget\n2028');
    await expect(field).toHaveValue('Budget 2028');
  },
};

// Wrapped text edits in a textarea, but keeps the one-line contract: Enter
// commits instead of adding a line, and pasted line breaks become spaces.
export const WrapKeepsOneLine: Story = {
  args: { wrap: true, onCommit: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button'));
    const field = canvas.getByRole<HTMLTextAreaElement>('textbox', {
      name: 'Process name',
    });
    await expect(field.tagName).toBe('TEXTAREA');

    await userEvent.clear(field);
    await userEvent.paste('Budget\n2028');
    await expect(field).toHaveValue('Budget 2028');

    await userEvent.keyboard('{Enter}');
    await expect(args.onCommit).toHaveBeenCalledTimes(1);
    await expect(args.onCommit).toHaveBeenCalledWith('Budget 2028');
    await waitFor(() =>
      expect(
        canvas.getByRole('button', { name: 'Edit Budget 2028' }),
      ).toHaveFocus(),
    );
  },
};

// Commits land on screen while `onCommit` stays the story's spy.
function Interactive({ value, onCommit, ...args }: EditableTextProps) {
  const [current, setCurrent] = useState(value);

  return (
    <EditableText
      {...args}
      value={current}
      onCommit={(next) => {
        setCurrent(next);
        onCommit(next);
      }}
    />
  );
}

function CommitLog(args: EditableTextProps) {
  const [value, setValue] = useState('Community fund 2027');
  const [commits, setCommits] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-4">
      <EditableText
        {...args}
        value={value}
        onCommit={(next) => {
          setValue(next);
          setCommits((previous) => [...previous, next]);
        }}
      />
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {commits.length === 0
          ? 'No commits yet.'
          : `Committed ${commits.length}: ${commits.at(-1)}`}
      </p>
    </div>
  );
}
