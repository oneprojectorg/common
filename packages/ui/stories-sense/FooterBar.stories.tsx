import { Button } from '@op/sense/Button';
import {
  FooterBar,
  FooterBarCenter,
  FooterBarDivider,
  FooterBarEnd,
  FooterBarStart,
} from '@op/sense/FooterBar';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LuCheck } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof FooterBar> = {
  title: 'Sense/Composites/FooterBar',
  component: FooterBar,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof FooterBar>;

// Mirrors the app's voting footer (ProposalsGrid): count with an accented
// number at the start, empty center spacer, primary action at the end.
// `position="static"` keeps the bar in flow for the story; the app uses
// `fixed` with a translucent background.
const VotingDemo = () => {
  const [numSelected, setNumSelected] = useState(2);
  const max = 5;

  return (
    <FooterBar position="static" className="w-full rounded border">
      <FooterBarStart>
        <span className="text-base">
          <span className="text-primary">{numSelected}</span> of {max} proposals
          selected
        </span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <Button
          variant="outline"
          onClick={() => setNumSelected((n) => (n + 1) % (max + 1))}
        >
          Select another
        </Button>
        <Button disabled={numSelected === 0}>Submit my votes</Button>
      </FooterBarEnd>
    </FooterBar>
  );
};

export const Voting: Story = {
  render: () => <VotingDemo />,
};

// Mirrors the advance-proposal footers (ReviewSummaryAdvanceFooter,
// StandardSelectionFooter): count at the start, toggling secondary action.
const AdvanceDemo = () => {
  const [advancing, setAdvancing] = useState(true);

  return (
    <FooterBar position="static" className="w-full rounded border">
      <FooterBarStart>
        <span className="text-base">
          {advancing ? 3 : 2} proposals advancing
        </span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <Button
          variant={advancing ? 'outline' : 'secondary'}
          size="sm"
          onClick={() => setAdvancing((a) => !a)}
          className={advancing ? 'border-primary text-primary' : undefined}
        >
          {advancing ? <LuCheck data-icon="inline-start" /> : null}
          {advancing ? 'Advancing proposal' : 'Advance proposal'}
        </Button>
      </FooterBarEnd>
    </FooterBar>
  );
};

export const AdvanceToggle: Story = {
  render: () => <AdvanceDemo />,
};

export const WithDivider: Story = {
  render: () => (
    <FooterBar position="static" className="w-full rounded border">
      <FooterBarStart>
        <span className="text-sm text-muted-foreground">Unsaved changes</span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <Button variant="ghost">Discard</Button>
        <FooterBarDivider />
        <Button variant="outline">Save draft</Button>
        <Button>Publish</Button>
      </FooterBarEnd>
    </FooterBar>
  ),
};
