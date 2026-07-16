import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { Field, FieldGroup, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Dialog> = {
  title: 'Sense/Dialog',
  component: Dialog,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Dialog>;

// The dialog renders in a portal outside the `.sense` wrapper, so the
// portaled content re-scopes itself with `className="sense"`.
export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Edit profile
      </DialogTrigger>
      <DialogContent className="sense">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="px-6 py-4">
          <Field>
            <FieldLabel htmlFor="dialog-name">Name</FieldLabel>
            <Input id="dialog-name" defaultValue="Frida Kahlo" />
          </Field>
          <Field>
            <FieldLabel htmlFor="dialog-username">Username</FieldLabel>
            <Input id="dialog-username" defaultValue="@fridakahlo" />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

// The panel is a grid with self-padding header/footer sections; capping its
// height makes the body row (min-h-0) the scroll container.
export const ScrollingBody: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        View community agreement
      </DialogTrigger>
      <DialogContent className="sense max-h-[min(32rem,80vh)] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>Community agreement</DialogTitle>
          <DialogDescription>
            Please review before joining the decision process.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-4 text-sm">
            {[
              'Participation is open to every confirmed member of the network. Each member holds an equal vote regardless of tenure or role.',
              'Proposals must state a clear outcome, a budget if funds are requested, and the people responsible for carrying the work forward.',
              'Discussion phases last at least one week so members across time zones can weigh in before any vote opens.',
              'Votes are cast privately. Aggregate results are published to all members once the voting phase closes.',
              'Members may delegate their vote for a given decision to another member they trust, and may revoke that delegation at any time before the vote closes.',
              'Facilitators may extend a phase when participation falls below quorum, but may never shorten one after it has been announced.',
              'Amendments to this agreement follow the same process as any other proposal, with a higher approval threshold of two thirds.',
              'Disputes about process are raised with the facilitation circle, whose decisions are documented and reviewable by the membership.',
            ].map((paragraph, index) => (
              <p key={index}>
                {index + 1}. {paragraph}
              </p>
            ))}
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          <Button>Agree and join</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
