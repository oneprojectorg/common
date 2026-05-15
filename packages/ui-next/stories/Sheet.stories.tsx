import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '@/components/Button';
import { Sheet, SheetBody, SheetHeader } from '@/components/Sheet';

const meta: Meta = {
  title: 'shadcn/Sheet',
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

const SheetStory = ({ side }: { side: 'bottom' | 'left' | 'right' }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onPress={() => setOpen(true)}>Open {side} sheet</Button>
      <Sheet isOpen={open} onOpenChange={setOpen} side={side}>
        <SheetHeader onClose={() => setOpen(false)}>{side} sheet</SheetHeader>
        <SheetBody className="p-4">
          <p className="text-sm">Sheet body content.</p>
        </SheetBody>
      </Sheet>
    </>
  );
};

export const Bottom: Story = {
  render: () => <SheetStory side="bottom" />,
};

export const Left: Story = {
  render: () => <SheetStory side="left" />,
};

export const Right: Story = {
  render: () => <SheetStory side="right" />,
};
