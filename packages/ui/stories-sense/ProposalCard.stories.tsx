import { Button } from '@op/sense/Button';
import { ProposalCard } from '@op/sense/ProposalCard';
import { StatusBadge } from '@op/sense/StatusBadge';
import { cn } from '@op/sense/lib/utils';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  LuBadgeCheck,
  LuCheck,
  LuEllipsis,
  LuPencil,
  LuTrash2,
} from 'react-icons/lu';
import Masonry from 'react-masonry-css';

import { withSense } from './sense';

const meta: Meta<typeof ProposalCard> = {
  title: 'Sense/Composites/ProposalCard',
  component: ProposalCard,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ProposalCard>;

const base = {
  title: 'Repave Calle del Río Pedestrian Path',
  budget: '$145,000',
  tags: ['Infrastructure', 'Accessibility', 'Streets', 'Safety', 'Transit'],
  authors: [{ name: 'Berhan Taye' }],
  description:
    'The stretch of Calle del Río between Avenida Monteclar and Plaza Verde has been in disrepair for over three years, making it unsafe for pedestrians and inaccessible for wheelchair users.',
};

// Top-right controls the card can carry via `aside`.
const MenuButton = () => (
  <Button variant="ghost" size="icon-sm" aria-label="Proposal options">
    <LuEllipsis />
  </Button>
);

const SelectToggle = ({ selected }: { selected?: boolean }) => (
  <span
    aria-hidden
    className={cn(
      'flex size-6 items-center justify-center rounded-full border',
      selected
        ? 'border-teal-600 bg-teal-600 text-white'
        : 'border-muted-foreground/40',
    )}
  >
    {selected ? <LuCheck className="size-4" /> : null}
  </span>
);

// Cards flow into a two-column masonry via react-masonry-css (same library as
// the app's ProposalMasonry), so varying card heights pack without a row grid.
// -ms-4 / ps-4 is the logical column gutter.
const MasonryGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[52rem]">
    <Masonry
      breakpointCols={2}
      className="-ms-4 flex w-auto"
      columnClassName="flex min-w-0 flex-col gap-4 ps-4"
    >
      {children}
    </Masonry>
  </div>
);

// A submitted proposal with working Like / Follow toggles.
const EngagementCard = () => {
  const [liked, setLiked] = useState(true);
  const [followed, setFollowed] = useState(false);
  return (
    <ProposalCard
      {...base}
      title="Improve bike lane safety signage"
      authors={[{ name: 'Raphael Arar' }]}
      aside={<MenuButton />}
      metrics={{
        likes: {
          count: liked ? 13 : 12,
          active: liked,
          onClick: () => setLiked((v) => !v),
        },
        bookmarks: {
          count: followed ? 4 : 3,
          active: followed,
          onClick: () => setFollowed((v) => !v),
        },
        comments: { count: 5, onClick: () => {} },
      }}
    />
  );
};

// Submission phase: a member's own draft (Edit / Delete) beside someone else's
// submission (engagement metrics, no owner actions).
export const Submission: Story = {
  render: () => (
    <MasonryGrid>
      <ProposalCard
        {...base}
        className="bg-muted"
        authors={[{ name: 'Berhan Taye' }, { name: 'Amara Okoye' }]}
        aside={<MenuButton />}
        actions={
          <>
            <Button variant="outline" size="sm" className="flex-1">
              <LuPencil aria-hidden />
              Edit
            </Button>
            <Button variant="destructive" size="sm" className="flex-1">
              <LuTrash2 aria-hidden />
              Delete
            </Button>
          </>
        }
      />
      <EngagementCard />
    </MasonryGrid>
  ),
};

// Review phase: the status row cycles through the StatusBadge variants, with a
// "N Reviewed" count on the right.
export const Review: Story = {
  render: () => (
    <MasonryGrid>
      <ProposalCard
        {...base}
        title="Improve bike lane safety signage"
        aside={<MenuButton />}
        status={<StatusBadge variant="success">Completed</StatusBadge>}
        reviewedLabel="5 Reviewed"
      />
      <ProposalCard
        {...base}
        title="Install solar panels on city hall roof"
        aside={<MenuButton />}
        status={<StatusBadge variant="in-progress">In progress</StatusBadge>}
        reviewedLabel="3 Reviewed"
      />
      <ProposalCard
        {...base}
        title="Create a community garden downtown"
        alert={<StatusBadge variant="alert">Revision requested</StatusBadge>}
        aside={<MenuButton />}
        status={<StatusBadge variant="warning">Review out of date</StatusBadge>}
        reviewedLabel="2 Reviewed"
      />
      <ProposalCard
        {...base}
        title="Organize annual cultural festival"
        aside={<MenuButton />}
        status={<StatusBadge variant="inactive">Not started</StatusBadge>}
        reviewedLabel="5 Reviewed"
      />
    </MasonryGrid>
  ),
};

// Vote phase: selectable cards. The selected card gets a teal border, teal
// title, and a filled check.
export const Vote: Story = {
  render: () => (
    <MasonryGrid>
      <ProposalCard
        {...base}
        title="Improve bike lane safety signage"
        selected
        aside={<SelectToggle selected />}
      />
      <ProposalCard
        {...base}
        title="Install solar panels on city hall roof"
        authors={[{ name: 'Elana Jacobs' }]}
        aside={<SelectToggle />}
      />
    </MasonryGrid>
  ),
};

// Selection phase: selectable, plus each card shows its running vote total.
export const Selection: Story = {
  render: () => (
    <MasonryGrid>
      <ProposalCard
        {...base}
        selected
        aside={<SelectToggle selected />}
        totalVotes={83}
      />
      <ProposalCard
        {...base}
        title="Install solar panels on city hall roof"
        authors={[{ name: 'Elana Jacobs' }]}
        aside={<SelectToggle />}
        totalVotes={64}
      />
    </MasonryGrid>
  ),
};

// Results phase: the whole card links to the proposal (stretched title link),
// while the "…" menu stays clickable above it. Metrics are display-only counts
// (no handlers) — non-interactive, matching the app's read-only views.
export const Results: Story = {
  render: () => (
    <div className="w-[26rem]">
      <ProposalCard
        {...base}
        href="#"
        aside={<MenuButton />}
        metrics={{ likes: 12, bookmarks: 4, comments: 8 }}
        totalVotes={83}
      />
    </div>
  ),
};

// Fully awarded owner view: status, total votes, the green awarded badge, and
// the Revise / Edit / Delete actions.
export const Awarded: Story = {
  render: () => (
    <div className="w-[26rem]">
      <ProposalCard
        {...base}
        totalVotes={83}
        awardedLabel={
          <StatusBadge variant="success" icon={LuBadgeCheck}>
            $145K Awarded
          </StatusBadge>
        }
      />
    </div>
  ),
};

// Compact form for map hovercards: title + authors + tags only.
export const MapPin: Story = {
  render: () => (
    <div className="w-[18rem]">
      <ProposalCard
        variant="pin"
        href="#"
        title={base.title}
        authors={base.authors}
        tags={['Infrastructure', 'Accessibility']}
      />
    </div>
  ),
};
