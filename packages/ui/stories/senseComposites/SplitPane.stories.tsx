import { SplitPane } from '@op/sense/SplitPane';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { SplitPane as OldSplitPane } from '../../src/components/SplitPane';

const meta: Meta = {
  title: 'Sense Comparison/Composites/SplitPane',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const paneBody = <p className="text-sm text-muted-foreground">Pane content</p>;

export const SplitPaneComparison: Story = {
  name: 'SplitPane',
  render: () => (
    <div className="p-8">
      <Section title="SplitPane">
        <Pair
          label="Two panes"
          old={
            <div className="h-64 w-full overflow-hidden rounded border">
              <OldSplitPane>
                <OldSplitPane.Pane id="a" label="Left">
                  {paneBody}
                </OldSplitPane.Pane>
                <OldSplitPane.Pane id="b" label="Right">
                  {paneBody}
                </OldSplitPane.Pane>
              </OldSplitPane>
            </div>
          }
          raw={
            <div className="h-64 w-full overflow-hidden rounded border">
              <SplitPane>
                <SplitPane.Pane id="a" label="Left">
                  {paneBody}
                </SplitPane.Pane>
                <SplitPane.Pane id="b" label="Right">
                  {paneBody}
                </SplitPane.Pane>
              </SplitPane>
            </div>
          }
        />
      </Section>
    </div>
  ),
};
