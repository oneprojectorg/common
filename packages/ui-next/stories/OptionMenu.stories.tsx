import type { Meta, StoryObj } from '@storybook/react-vite';

import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/Menu';
import { OptionMenu } from '@/components/OptionMenu';

const meta: Meta = {
  title: 'shadcn/OptionMenu',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <OptionMenu aria-label="Row actions">
      <DropdownMenuItem onClick={() => console.log('edit')}>
        Edit
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => console.log('duplicate')}>
        Duplicate
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => console.log('delete')}
      >
        Delete
      </DropdownMenuItem>
    </OptionMenu>
  ),
};

export const Outline: Story = {
  render: () => (
    <OptionMenu aria-label="Outline" variant="outline" size="medium">
      <DropdownMenuItem>Action 1</DropdownMenuItem>
      <DropdownMenuItem>Action 2</DropdownMenuItem>
    </OptionMenu>
  ),
};
