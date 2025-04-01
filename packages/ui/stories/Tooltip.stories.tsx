import { PrinterIcon, SaveIcon } from 'lucide-react';
import { TooltipTrigger } from 'react-aria-components';

import { Button } from '../src/components/Button';
import { Tooltip } from '../src/components/Tooltip';

import type { Meta } from '@storybook/react';

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
        <SaveIcon className="size-5" />
      </Button>
      <Tooltip {...args}>Save</Tooltip>
    </TooltipTrigger>
    <TooltipTrigger>
      <Button className="px-2">
        <PrinterIcon className="size-5" />
      </Button>
      <Tooltip {...args}>Print</Tooltip>
    </TooltipTrigger>
  </div>
);
