import type { Meta, StoryObj } from '@storybook/react';

import { SplitPane } from '../src/components/SplitPane';

const meta: Meta<typeof SplitPane> = {
  title: 'SplitPane',
  component: SplitPane,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="flex h-dvh flex-col bg-white">
        <Story />
      </div>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SplitPane>;

const SamplePane = ({
  title,
  tone,
}: {
  title: string;
  tone: 'muted' | 'plain';
}) => (
  <div
    className={`flex flex-col gap-4 ${tone === 'muted' ? 'text-neutral-gray4' : 'text-charcoal'}`}
  >
    <h2 className="text-title-base">{title}</h2>
    {Array.from({ length: 12 }).map((_, i) => (
      <p key={i} className="text-sm">
        Paragraph {i + 1}. Each side scrolls independently, and both sides share
        a stable scrollbar gutter so the layout doesn't shift.
      </p>
    ))}
  </div>
);

export const Default: Story = {
  render: () => (
    <SplitPane>
      <SplitPane.Pane id="proposal" label="Proposal">
        <SamplePane title="Proposal" tone="plain" />
      </SplitPane.Pane>
      <SplitPane.Pane id="review" label="Review">
        <SamplePane title="Review" tone="muted" />
      </SplitPane.Pane>
    </SplitPane>
  ),
};

export const DefaultsToSecondOnMobile: Story = {
  render: () => (
    <SplitPane defaultMobileTabId="review">
      <SplitPane.Pane id="proposal" label="Proposal">
        <SamplePane title="Proposal" tone="plain" />
      </SplitPane.Pane>
      <SplitPane.Pane id="review" label="Review">
        <SamplePane title="Review" tone="muted" />
      </SplitPane.Pane>
    </SplitPane>
  ),
};
