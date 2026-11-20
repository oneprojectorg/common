import { DatePicker, DatePickerButton } from '@op/sense/DatePicker';
import { Header2 } from '@op/sense/Header';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { Switch } from '@op/sense/Switch';
import { Textarea } from '@op/sense/Textarea';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';

type Mode = 'editable' | 'disabled' | 'readOnly';

const meta: Meta = {
  title: 'Primitives/Read-only',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Read-only shows a fixed value as a record: focusable and announced, on a tinted surface with full-contrast text. Disabled stays faded for controls that are unavailable right now.',
      },
    },
  },
};

export default meta;

type Story = StoryObj;

const MODES: { mode: Mode; heading: string }[] = [
  { mode: 'editable', heading: 'Editable' },
  { mode: 'disabled', heading: 'Disabled' },
  { mode: 'readOnly', heading: 'Read-only' },
];

const date = new Date(2026, 5, 15);
const limitItems = [
  { value: '3', label: '3 votes' },
  { value: '5', label: '5 votes' },
];

const modeProps = (mode: Mode) => ({
  disabled: mode === 'disabled',
  readOnly: mode === 'readOnly',
});

export const Comparison: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-8">
      {MODES.map(({ mode, heading }) => (
        <section key={mode} className="flex w-64 flex-col gap-6">
          <Header2 className="text-title">{heading}</Header2>
          <LabelledField id={`${mode}-name`} label="Phase name">
            <Input
              id={`${mode}-name`}
              defaultValue="Proposal submission"
              {...modeProps(mode)}
            />
          </LabelledField>
          <LabelledField id={`${mode}-description`} label="Description">
            <Textarea
              id={`${mode}-description`}
              defaultValue="Members submit proposals for the community budget."
              {...modeProps(mode)}
            />
          </LabelledField>
          <DatePicker label="Start date" value={date} {...modeProps(mode)} />
          <DatePickerButton
            label="End date"
            value={date}
            {...modeProps(mode)}
          />
          <LabelledField id={`${mode}-limit`} label="Vote limit">
            <Select items={limitItems} defaultValue="5" {...modeProps(mode)}>
              <SelectTrigger id={`${mode}-limit`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {limitItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </LabelledField>
          <SwitchRow
            id={`${mode}-on`}
            label="Proposals open (on)"
            checked
            mode={mode}
          />
          <SwitchRow
            id={`${mode}-off`}
            label="Voting open (off)"
            checked={false}
            mode={mode}
          />
        </section>
      ))}
    </div>
  ),
};

function LabelledField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  mode,
}: {
  id: string;
  label: string;
  checked: boolean;
  mode: Mode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Switch id={id} defaultChecked={checked} {...modeProps(mode)} />
    </div>
  );
}
