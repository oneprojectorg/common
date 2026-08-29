import { ProposalCard } from '@op/sense/ProposalCard';
import { ProposalFeed, ProposalFeedItem } from '@op/sense/ProposalFeed';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof ProposalFeed> = {
  title: 'Composites/ProposalFeed',
  component: ProposalFeed,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ProposalFeed>;

const PROPOSALS = [
  {
    title: 'Repave Calle del Río Pedestrian Path',
    budget: '$145,000',
    tags: ['Infrastructure', 'Accessibility', 'Streets'],
    authors: [{ name: 'Berhan Taye' }, { name: 'Amara Okoye' }],
    description:
      'The stretch of Calle del Río between Avenida Monteclar and Plaza Verde has been in disrepair for over three years, making it unsafe for pedestrians and inaccessible for wheelchair users. This proposal repaves the full 400-meter path and adds tactile paving at both crossings.',
    metrics: { likes: 13, bookmarks: 4, comments: 5 },
  },
  {
    title: 'Install solar panels on city hall roof',
    budget: '$98,000',
    tags: ['Energy', 'Climate'],
    authors: [{ name: 'Elana Jacobs' }],
    description:
      "City hall's flat roof gets unobstructed sun for most of the day. A 46kW array would cover roughly a third of the building's electricity use and pay for itself within nine years.",
    metrics: { likes: 21, bookmarks: 7, comments: 9 },
  },
  {
    title: 'Create a community garden downtown',
    budget: '$62,500',
    tags: ['Green space', 'Community'],
    authors: [{ name: 'Mateo Reyes' }, { name: 'Priya Shah' }],
    description:
      'Convert the vacant lot on 5th Street into a shared garden with twenty raised beds, a tool shed, and a rain collection system. Beds are assigned by lottery each season, with five reserved for the food bank kitchen.',
    metrics: { likes: 34, bookmarks: 15, comments: 12 },
  },
  {
    title: 'Improve bike lane safety signage',
    budget: '$15,000',
    tags: ['Transportation'],
    authors: [{ name: 'Raphael Arar' }],
    description:
      'Install clearer and more visible signs along bike lanes to enhance safety for cyclists and motorists.',
    metrics: { likes: 12, bookmarks: 3, comments: 5 },
  },
  {
    title: 'Expand public library hours',
    budget: '$25,000',
    tags: ['Education'],
    authors: [{ name: 'Iza Romanowska' }],
    description:
      'Extend evening and weekend hours at the central branch so working residents and students can actually use it.',
    metrics: { likes: 18, bookmarks: 6, comments: 7 },
  },
];

// The feed inside a page-like scroll container: scroll to move the focal
// point — the card nearest the center reads at full opacity while its
// neighbors dim and settle back by distance.
export const Default: Story = {
  render: () => (
    <div className="h-[40rem] w-[64rem] overflow-y-auto rounded-xl border bg-background px-6">
      <ProposalFeed>
        {PROPOSALS.map((proposal) => (
          <ProposalFeedItem key={proposal.title}>
            <ProposalCard {...proposal} href="#" />
          </ProposalFeedItem>
        ))}
      </ProposalFeed>
    </div>
  ),
};

// dimStrength={0} turns the focal treatment off entirely — the feed becomes a
// plain single-column list, which is also what screen readers experience.
export const NoDimming: Story = {
  render: () => (
    <div className="h-[40rem] w-[64rem] overflow-y-auto rounded-xl border bg-background px-6">
      <ProposalFeed dimStrength={0}>
        {PROPOSALS.slice(0, 3).map((proposal) => (
          <ProposalFeedItem key={proposal.title}>
            <ProposalCard {...proposal} href="#" />
          </ProposalFeedItem>
        ))}
      </ProposalFeed>
    </div>
  ),
};

// Keyboard pass: tab through the cards — an item holding focus always lifts
// to full opacity, even when it is not the scroll-focal item.
export const KeyboardFocus: Story = {
  render: () => (
    <div className="h-[40rem] w-[64rem] overflow-y-auto rounded-xl border bg-background px-6">
      <ProposalFeed dimStrength={0.8}>
        {PROPOSALS.map((proposal) => (
          <ProposalFeedItem key={proposal.title}>
            <ProposalCard {...proposal} href="#" />
          </ProposalFeedItem>
        ))}
      </ProposalFeed>
    </div>
  ),
};
