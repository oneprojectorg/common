import { Button } from '@op/sense/Button';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarDivider,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof FooterBar> = {
  title: 'Sense/Composites/FooterBar',
  component: FooterBar,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof FooterBar>;

// `position="static"` in stories so the bar sits in flow; app usage is
// sticky (default) or fixed.
export const Default: Story = {
  render: () => (
    <FooterBar position="static" className="w-full rounded border">
      <FooterBarStart>
        <Button variant="ghost">Back</Button>
      </FooterBarStart>
      <FooterBarCenter>
        <span className="text-sm text-muted-foreground">Step 2 of 4</span>
      </FooterBarCenter>
      <FooterBarEnd>
        <Button variant="outline">Save draft</Button>
        <FooterBarDivider />
        <Button>Continue</Button>
      </FooterBarEnd>
    </FooterBar>
  ),
};

export const Spacious: Story = {
  render: () => (
    <FooterBar
      position="static"
      padding="spacious"
      className="w-full rounded border"
    >
      <FooterBarStart>
        <span className="text-sm text-muted-foreground">Unsaved changes</span>
      </FooterBarStart>
      <FooterBarEnd>
        <Button variant="outline">Discard</Button>
        <Button>Publish</Button>
      </FooterBarEnd>
    </FooterBar>
  ),
};
