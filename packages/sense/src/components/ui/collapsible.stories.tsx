import { Button } from '@op/sense/Button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@op/sense/Collapsible';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuChevronsUpDown } from 'react-icons/lu';

const meta: Meta<typeof Collapsible> = {
  title: 'Primitives/Collapsible',
  component: Collapsible,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Collapsible>;

export const Default: Story = {
  render: () => (
    <Collapsible className="flex w-80 flex-col gap-2">
      <div className="flex items-center justify-between gap-4 px-4">
        <h4 className="text-sm font-strong">Starred 3 repositories</h4>
        <CollapsibleTrigger
          render={<Button variant="ghost" size="icon-sm" />}
          aria-label="Toggle"
        >
          <LuChevronsUpDown />
        </CollapsibleTrigger>
      </div>
      <div className="rounded-lg border px-4 py-2 text-sm">@base-ui/react</div>
      <CollapsibleContent className="flex flex-col gap-2">
        <div className="rounded-lg border px-4 py-2 text-sm">@op/sense</div>
        <div className="rounded-lg border px-4 py-2 text-sm">@op/styles</div>
      </CollapsibleContent>
    </Collapsible>
  ),
};
