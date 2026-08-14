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
import { cn } from '@op/sense/lib/utils';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Dialog> = {
  title: 'Primitives/Dialog',
  component: Dialog,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Edit profile
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="px-6 pt-8 pb-10">
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

const communityAgreement = [
  {
    heading: 'Preamble',
    clauses: [
      'We, the members of this community, having discovered that group decisions are somehow both everyone’s job and no one’s job, adopt this agreement so that they may become everyone’s job in an organized fashion.',
      'This agreement is binding in the way a good potluck is binding: nobody will arrest you for bringing nothing, but everyone will remember.',
    ],
  },
  {
    heading: 'Participation',
    clauses: [
      'Participation is open to every confirmed member of the network. Each member holds an equal vote regardless of tenure, role, or how loudly they type.',
      'Lurking is a legitimate form of participation. Lurkers who finally speak up in their third year shall be greeted warmly and not asked where they have been.',
      'Members joining from time zones where it is currently tomorrow may vote today on yesterday’s proposals without creating a paradox.',
    ],
  },
  {
    heading: 'Proposals',
    clauses: [
      'Proposals must state a clear outcome, a budget if funds are requested, and the people responsible for carrying the work forward.',
      'A proposal titled “Quick question” that is neither quick nor a question shall be returned to its author for renaming.',
      'Proposals to buy a boat must include a plan for the boat. Historical experience informs this clause.',
      'The scope of a proposal may not grow during discussion. Scope discovered mid-discussion becomes a new proposal, which is how we all learn to let go.',
    ],
  },
  {
    heading: 'Discussion',
    clauses: [
      'Discussion phases last at least one week so members across time zones can weigh in before any vote opens.',
      'Disagreement is welcome. Disagreement expressed in all capital letters will be gently lowercased by the facilitation circle.',
      'A member who changes their mind in public shall be celebrated, not screenshot.',
    ],
  },
  {
    heading: 'Voting',
    clauses: [
      'Votes are cast privately. Aggregate results are published to all members once the voting phase closes.',
      'Members may allocate their votes across proposals however they wish, including placing all ten on the community garden again.',
      'Abstaining is a vote for trusting everyone else, which is either wisdom or delegation depending on the outcome.',
    ],
  },
  {
    heading: 'Delegation',
    clauses: [
      'Members may delegate their vote for a given decision to another member they trust, and may revoke that delegation at any time before the vote closes.',
      'Delegating your vote to someone because they “seem to read the documents” is explicitly permitted and, frankly, the system working as intended.',
      'Circular delegation chains (A delegates to B, who delegates to A) resolve by both parties actually reading the proposal.',
    ],
  },
  {
    heading: 'Facilitation',
    clauses: [
      'Facilitators may extend a phase when participation falls below quorum, but may never shorten one after it has been announced.',
      'Facilitators serve the process, not the outcome. A facilitator with strong feelings about a proposal hands the gavel to someone with weaker ones.',
      'The facilitation circle maintains the official record, the unofficial record, and the record of which records exist.',
    ],
  },
  {
    heading: 'Amendments',
    clauses: [
      'Amendments to this agreement follow the same process as any other proposal, with a higher approval threshold of two thirds.',
      'Amendments to this clause about amendments require three quarters, and amendments to that requirement are discouraged on the grounds of infinite regress.',
    ],
  },
  {
    heading: 'Disputes',
    clauses: [
      'Disputes about process are raised with the facilitation circle, whose decisions are documented and reviewable by the membership.',
      'Disputes about whether something is a dispute are, regrettably, disputes.',
    ],
  },
  {
    heading: 'Appendix A: Meetings',
    clauses: [
      'Any meeting that could have been a proposal shall become a proposal. Any proposal that could have been a meeting shall be quietly grateful it is not one.',
      'The seventeenth minute of any discussion about renaming a channel concludes the discussion. The original name is retained.',
    ],
  },
] as const;

// Upstream pattern: cap and scroll the body div; header and footer stay put.
export const ScrollingBody: Story = {
  render: () => <AgreementDialog bodyClassName="max-h-[calc(100dvh-14rem)]" />,
};

// Narrow the viewport below `sm` (640px) to see the mobile treatment: the popup
// fills the screen, the header pins to the top, the footer pins to the bottom,
// and only the middle scrolls. `overflow-hidden` + a `flex-1 min-h-0` body is
// what moves the scroll off the popup and onto the body.
export const MobileFullScreen: Story = {
  render: () => (
    <AgreementDialog
      contentClassName="overflow-hidden"
      bodyClassName="min-h-0 flex-1"
    />
  ),
};

// Long enough to overflow a phone screen, so the two stories above differ only
// in how they hand the overflow to the body.
const AgreementDialog = ({
  contentClassName,
  bodyClassName,
}: {
  contentClassName?: string;
  bodyClassName?: string;
}) => (
  <Dialog>
    <DialogTrigger render={<Button variant="outline" />}>
      View community agreement
    </DialogTrigger>
    <DialogContent className={contentClassName}>
      <DialogHeader>
        <DialogTitle>Community agreement</DialogTitle>
        <DialogDescription>
          Please review before joining the decision process.
        </DialogDescription>
      </DialogHeader>
      <div className={cn('overflow-y-auto px-6 py-4', bodyClassName)}>
        <div className="flex flex-col gap-6">
          {communityAgreement.map((section) => (
            <section key={section.heading} className="flex flex-col gap-3">
              <h3 className="font-serif text-label">{section.heading}</h3>
              {section.clauses.map((clause, index) => (
                <p key={index}>{clause}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        <Button>Agree and join</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
