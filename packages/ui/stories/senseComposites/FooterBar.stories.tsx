import { Button } from '@op/sense/Button';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarDivider,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { Button as OldButton } from '../../src/components/Button';
import {
  FooterBar as OldFooterBar,
  FooterBarCenter as OldFooterBarCenter,
  FooterBarDivider as OldFooterBarDivider,
  FooterBarEnd as OldFooterBarEnd,
  FooterBarStart as OldFooterBarStart,
} from '../../src/components/FooterBar';

// Note: the port drops the FooterBar.Start dot-alias API — named imports
// only, matching the rest of @op/sense.

const meta: Meta = {
  title: 'Sense Comparison/Composites/FooterBar',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

export const FooterBarComparison: Story = {
  name: 'FooterBar',
  render: () => (
    <div className="p-8">
      <Section title="FooterBar">
        <Pair
          label="Action bar"
          old={
            <OldFooterBar position="static" className="w-full rounded border">
              <OldFooterBarStart>
                <OldButton color="neutral">Back</OldButton>
              </OldFooterBarStart>
              <OldFooterBarCenter>
                <span className="text-sm">Step 2 of 4</span>
              </OldFooterBarCenter>
              <OldFooterBarEnd>
                <OldButton color="secondary">Save draft</OldButton>
                <OldFooterBarDivider />
                <OldButton>Continue</OldButton>
              </OldFooterBarEnd>
            </OldFooterBar>
          }
          raw={
            <FooterBar position="static" className="w-full rounded border">
              <FooterBarStart>
                <Button variant="ghost">Back</Button>
              </FooterBarStart>
              <FooterBarCenter>
                <span className="text-sm text-muted-foreground">
                  Step 2 of 4
                </span>
              </FooterBarCenter>
              <FooterBarEnd>
                <Button variant="outline">Save draft</Button>
                <FooterBarDivider />
                <Button>Continue</Button>
              </FooterBarEnd>
            </FooterBar>
          }
        />
      </Section>
    </div>
  ),
};
