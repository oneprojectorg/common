import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
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

const meta: Meta<typeof FooterBar> = {
  title: 'Composites/FooterBar',
  component: FooterBar,
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

// Mirrors the selection-confirm footers (StandardSelectionFooter,
// FinalPhaseSelectionFooter): the end slot is a dialog trigger with a
// responsive label — short on mobile, full text from `sm:` up.
const ConfirmSelectionDemo = () => {
  const [open, setOpen] = useState(false);

  return (
    <FooterBar position="static" className="w-full rounded border">
      <FooterBarStart>
        <span className="text-base">3 winning proposals selected</span>
      </FooterBarStart>
      <FooterBarCenter />
      <FooterBarEnd>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <span className="sm:hidden">Confirm</span>
            <span className="hidden sm:inline">Confirm winning proposals</span>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm winning proposals</DialogTitle>
              <DialogDescription>
                These 3 proposals will be funded and results will be shared with
                all participants.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setOpen(false)}>Publish results</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </FooterBarEnd>
    </FooterBar>
  );
};

export const ConfirmSelection: Story = {
  render: () => <ConfirmSelectionDemo />,
};
