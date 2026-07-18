import { FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof RequiredAsterisk> = {
  title: 'Sense/Composites/RequiredAsterisk',
  component: RequiredAsterisk,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof RequiredAsterisk>;

// Decorative marker only — the input itself carries `required`.
export const Default: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-1">
      <FieldLabel htmlFor="required-demo">
        Organization name
        <RequiredAsterisk />
      </FieldLabel>
      <Input id="required-demo" required placeholder="One Project" />
    </div>
  ),
};
