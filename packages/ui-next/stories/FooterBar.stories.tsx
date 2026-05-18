import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '@/components/Button';
import { FooterBar } from '@/components/FooterBar';

const meta: Meta<typeof FooterBar> = {
  title: 'shadcn/FooterBar',
  component: FooterBar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="relative h-64 w-full bg-muted/40">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FooterBar>;

export const Default: Story = {
  render: () => (
    <FooterBar>
      <FooterBar.Start>2 of 10 selected</FooterBar.Start>
      <FooterBar.Center />
      <FooterBar.End>
        <Button>Submit</Button>
      </FooterBar.End>
    </FooterBar>
  ),
};
