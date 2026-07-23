import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';

import { PhaseCard } from '../src/components/PhaseCard';

const meta: Meta<typeof PhaseCard> = {
  title: 'Legacy/PhaseCard',
  component: PhaseCard,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    state: {
      control: 'select',
      options: ['completed', 'current', 'upcoming'],
    },
    onAdvance: { action: 'onAdvance' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const wrap: Decorator = (Story) => (
  <ol className="flex max-w-[340px] flex-col gap-6">
    <Story />
  </ol>
);

/** All four treatments composed in a single <code>\<ol\></code>, as a consumer would. */
export const Timeline: StoryObj = {
  render: () => (
    <ol className="flex max-w-[340px] flex-col gap-6">
      <PhaseCard
        state="completed"
        name="Collect Ideas"
        startDate="2026-07-01"
        endDate="2026-07-31"
      />
      <PhaseCard
        state="current"
        name="Review"
        startDate="2026-08-01"
        endDate="2026-09-15"
        isNowOpen
        href="#"
      />
      <PhaseCard
        state="upcoming"
        name="Vote"
        startDate="2026-09-16"
        endDate="2026-11-31"
        isAdvanceable
      />
      <PhaseCard state="upcoming" name="Share Results" endDate="2026-12-18" />
    </ol>
  ),
};

export const Completed: Story = {
  args: {
    state: 'completed',
    name: 'Collect Ideas',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
  },
  decorators: [wrap],
};

export const Current: Story = {
  args: {
    state: 'current',
    name: 'Review',
    startDate: '2026-08-01',
    endDate: '2026-09-15',
    isNowOpen: true,
    href: '#',
  },
  decorators: [wrap],
};

export const Upcoming: Story = {
  args: {
    state: 'upcoming',
    name: 'Share Results',
    endDate: '2026-12-18',
  },
  decorators: [wrap],
};

export const Advanceable: Story = {
  args: {
    state: 'upcoming',
    name: 'Vote',
    startDate: '2026-09-16',
    endDate: '2026-11-31',
    isAdvanceable: true,
  },
  decorators: [wrap],
};
