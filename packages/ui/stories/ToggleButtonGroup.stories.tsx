import type { Meta } from '@storybook/react';
import { Italic, Underline } from 'lucide-react';

import { ToggleButton } from '../src/components/ToggleButton';
import { ToggleButtonGroup } from '../src/components/ToggleButtonGroup';

const meta: Meta<typeof ToggleButtonGroup> = {
  component: ToggleButtonGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => (
  <ToggleButtonGroup {...args}>
    <ToggleButton id="bold" aria-label="Bold" />
    <ToggleButton id="italic" aria-label="Italic">
      <Italic className="size-4" />
    </ToggleButton>
    <ToggleButton id="underline" aria-label="Underline">
      <Underline className="size-4" />
    </ToggleButton>
  </ToggleButtonGroup>
);

Example.args = {
  selectionMode: 'multiple',
};
