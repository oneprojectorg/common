import { RankCheckbox } from '@op/sense/RankCheckbox';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof RankCheckbox> = {
  title: 'Composites/RankCheckbox',
  component: RankCheckbox,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof RankCheckbox>;

export const Default: Story = {
  args: { 'aria-label': 'Select Community garden' },
};

export const Ranked: Story = {
  args: {
    defaultChecked: true,
    rank: 2,
    'aria-label': 'Community garden, ranked number 2',
  },
};

export const Disabled: Story = {
  args: { disabled: true, 'aria-label': 'Select Community garden' },
};

const PROPOSALS = ['Community garden', 'Bike lanes', 'Library hours'];

export const Ballot: Story = {
  render: () => {
    const [picks, setPicks] = useState<string[]>([]);

    return (
      <ul className="flex flex-col gap-3">
        {PROPOSALS.map((title) => {
          const rank = picks.indexOf(title) + 1;

          return (
            <li key={title} className="flex items-center gap-3">
              <RankCheckbox
                checked={rank > 0}
                rank={rank > 0 ? rank : undefined}
                onCheckedChange={(checked) =>
                  setPicks((previous) =>
                    checked
                      ? [...previous, title]
                      : previous.filter((pick) => pick !== title),
                  )
                }
                aria-label={
                  rank > 0 ? `${title}, ranked number ${rank}` : title
                }
              />
              <span className="text-sm">{title}</span>
            </li>
          );
        })}
      </ul>
    );
  },
};
