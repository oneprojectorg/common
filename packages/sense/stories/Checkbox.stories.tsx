import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState } from 'react';

import { Checkbox } from '@/components/Checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/components/Field';

const meta: Meta<typeof Checkbox> = {
  title: 'shadcn/Checkbox',
  component: Checkbox,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  render: () => {
    const id = useId();
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={id} />
        <label htmlFor={id} className="text-sm">
          Accept terms
        </label>
      </div>
    );
  },
};

export const Controlled: Story = {
  render: () => {
    const id = useId();
    const [checked, setChecked] = useState(false);
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => setChecked(v === true)}
        />
        <label htmlFor={id} className="text-sm">
          Checked: {String(checked)}
        </label>
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => {
    const id = useId();
    return (
      <div className="flex items-center gap-2">
        <Checkbox id={id} disabled />
        <label htmlFor={id} className="text-sm opacity-50">
          Disabled
        </label>
      </div>
    );
  },
};

export const Group: Story = {
  name: 'Field composition (group)',
  render: () => {
    const ids = [useId(), useId(), useId()];
    return (
      <Field className="w-72">
        <FieldLabel>Notification preferences</FieldLabel>
        <FieldDescription>Pick what you want to hear about.</FieldDescription>
        <div className="flex flex-col gap-2" role="group">
          {['Emails', 'Pushes', 'SMS'].map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <Checkbox id={ids[i]} />
              <label htmlFor={ids[i]} className="text-sm">
                {label}
              </label>
            </div>
          ))}
        </div>
        <FieldError />
      </Field>
    );
  },
};
