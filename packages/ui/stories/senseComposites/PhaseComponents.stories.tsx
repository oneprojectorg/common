import { PhaseCard } from '@op/sense/PhaseCard';
import { PhaseStepper } from '@op/sense/PhaseStepper';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import { PhaseCard as OldPhaseCard } from '../../src/components/PhaseCard';
import { PhaseStepper as OldPhaseStepper } from '../../src/components/PhaseStepper';

const meta: Meta = {
  title: 'Sense Comparison/Composites/Phase components',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const phases = [
  {
    id: 'a',
    name: 'Submissions',
    startDate: '2026-06-01',
    endDate: '2026-06-14',
  },
  { id: 'b', name: 'Review', startDate: '2026-06-15' },
  { id: 'c', name: 'Voting' },
];

export const PhaseComparison: Story = {
  name: 'Phase components',
  render: () => (
    <div className="p-8">
      <Section title="PhaseStepper">
        <Pair
          label="Timeline"
          old={<OldPhaseStepper phases={phases} currentPhaseId="b" />}
          raw={<PhaseStepper phases={phases} currentPhaseId="b" />}
        />
      </Section>
      <Section title="PhaseCard">
        <Pair
          label="States"
          old={
            <ol className="flex w-80 flex-col gap-2">
              <OldPhaseCard
                state="completed"
                name="Submissions"
                startDate="2026-06-01"
                endDate="2026-06-14"
              />
              <OldPhaseCard state="current" name="Review" isNowOpen href="#" />
              <OldPhaseCard state="upcoming" name="Voting" />
            </ol>
          }
          raw={
            <ol className="flex w-80 flex-col gap-2">
              <PhaseCard
                state="completed"
                name="Submissions"
                startDate="2026-06-01"
                endDate="2026-06-14"
              />
              <PhaseCard state="current" name="Review" isNowOpen href="#" />
              <PhaseCard state="upcoming" name="Voting" />
            </ol>
          }
        />
      </Section>
    </div>
  ),
};
