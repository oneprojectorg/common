import type { Meta, StoryObj } from '@storybook/react-vite';

import { SplitPane } from '@/components/SplitPane';

const meta: Meta<typeof SplitPane> = {
  title: 'shadcn/SplitPane',
  component: SplitPane,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="h-96 w-full">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SplitPane>;

export const Two: Story = {
  render: () => (
    <SplitPane>
      <SplitPane.Pane id="left" label="Left">
        <p>Left pane content</p>
      </SplitPane.Pane>
      <SplitPane.Pane id="right" label="Right">
        <p>Right pane content</p>
      </SplitPane.Pane>
    </SplitPane>
  ),
};

export const Single: Story = {
  render: () => (
    <SplitPane>
      <SplitPane.Pane id="only" label="Only">
        <p>Single pane (no tabs on mobile)</p>
      </SplitPane.Pane>
    </SplitPane>
  ),
};
