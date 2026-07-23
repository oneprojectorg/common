import { SplitPane } from '@op/sense/SplitPane';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof SplitPane> = {
  title: 'Sense/Composites/SplitPane',
  component: SplitPane,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof SplitPane>;

// Two panes side by side from `sm` up; below that a tab bar switches
// between them (panes stay mounted — visibility is CSS-only). Narrow the
// viewport to see the mobile mode.
export const Default: Story = {
  render: () => (
    <div className="flex h-96 w-full flex-col overflow-hidden rounded border">
      <SplitPane>
        <SplitPane.Pane id="editor" label="Editor">
          <p className="text-sm text-muted-foreground">
            Editor pane — keeps its state when the mobile tabs switch away.
          </p>
        </SplitPane.Pane>
        <SplitPane.Pane id="preview" label="Preview">
          <p className="text-sm text-muted-foreground">Preview pane.</p>
        </SplitPane.Pane>
      </SplitPane>
    </div>
  ),
};

export const Unpadded: Story = {
  render: () => (
    <div className="flex h-96 w-full flex-col overflow-hidden rounded border">
      <SplitPane>
        <SplitPane.Pane id="list" label="List" unpadded>
          <div className="bg-muted p-4 text-sm">Unpadded pane</div>
        </SplitPane.Pane>
        <SplitPane.Pane id="detail" label="Detail">
          <p className="text-sm text-muted-foreground">Padded pane.</p>
        </SplitPane.Pane>
      </SplitPane>
    </div>
  ),
};
