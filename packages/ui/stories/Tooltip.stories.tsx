import type { Meta } from '@storybook/react-vite';
import { TooltipTrigger } from 'react-aria-components';
import { LuPrinter, LuSave } from 'react-icons/lu';

import { Button } from '../src/components/Button';
import { Tooltip } from '../src/components/Tooltip';

const meta: Meta<typeof Tooltip> = {
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => (
  <div className="flex gap-2">
    <TooltipTrigger>
      <Button className="px-2">
        <LuSave className="size-5" />
      </Button>
      <Tooltip {...args}>Save</Tooltip>
    </TooltipTrigger>
    <TooltipTrigger>
      <Button className="px-2">
        <LuPrinter className="size-5" />
      </Button>
      <Tooltip {...args}>Print</Tooltip>
    </TooltipTrigger>
  </div>
);
