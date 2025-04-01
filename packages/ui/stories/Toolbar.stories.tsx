import { BoldIcon, ItalicIcon, UnderlineIcon } from 'lucide-react';
import { Group } from 'react-aria-components';

import { Button } from '../src/components/Button';
import { Checkbox } from '../src/components/Checkbox';
import { Separator } from '../src/components/Separator';
import { ToggleButton } from '../src/components/ToggleButton';
import { Toolbar } from '../src/components/Toolbar';

import type { Meta } from '@storybook/react';
import type { ToolbarProps } from 'react-aria-components';

const meta: Meta<typeof Toolbar> = {
  component: Toolbar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: ToolbarProps) => (
  <Toolbar aria-label="Text formatting" {...args}>
    <Group aria-label="Style" className="contents">
      <ToggleButton aria-label="Bold" className="p-2.5">
        <BoldIcon className="size-4" />
      </ToggleButton>
      <ToggleButton aria-label="Italic" className="p-2.5">
        <ItalicIcon className="size-4" />
      </ToggleButton>
      <ToggleButton aria-label="Underline" className="p-2.5">
        <UnderlineIcon className="size-4" />
      </ToggleButton>
    </Group>
    <Separator
      orientation={args.orientation === 'vertical' ? 'horizontal' : 'vertical'}
    />
    <Group aria-label="Clipboard" className="contents">
      <Button>Copy</Button>
      <Button>Paste</Button>
      <Button>Cut</Button>
    </Group>
    <Separator
      orientation={args.orientation === 'vertical' ? 'horizontal' : 'vertical'}
    />
    <Checkbox>Night Mode</Checkbox>
  </Toolbar>
);
