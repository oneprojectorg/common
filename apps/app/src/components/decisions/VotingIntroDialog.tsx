'use client';

import { useLocalStorage } from '@/utils/useLocalStorage';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@op/sense/Dialog';
import { ProposalCard } from '@op/sense/ProposalCard';
import { RankCheckbox } from '@op/sense/RankCheckbox';
import { cn } from '@op/sense/lib/utils';
import { type ComponentProps, type ReactNode, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { type BallotBudget, formatBallotAmount } from './ballot';
import { getVotingIntroSteps } from './votingIntro';

interface VotingIntroDialogProps {
  instanceId: string;
  ranked: boolean;
  budget?: BallotBudget;
}

export const VotingIntroDialog = ({
  instanceId,
  ranked,
  budget,
}: VotingIntroDialogProps) => {
  const t = useTranslations();
  const [isSeen, setIsSeen] = useLocalStorage(
    `voting-intro-seen:${instanceId}`,
    false,
  );
  const [stepIndex, setStepIndex] = useState(0);

  const steps = getVotingIntroSteps({ ranked, budget });
  const step = steps[stepIndex];

  if (!step) {
    return null;
  }

  const isLastStep = stepIndex === steps.length - 1;
  const dismiss = () => setIsSeen(true);

  let startAction: ReactNode = null;
  if (stepIndex > 0) {
    startAction = (
      <Button variant="ghost" onClick={() => setStepIndex(stepIndex - 1)}>
        {t('Back')}
      </Button>
    );
  } else if (!isLastStep) {
    startAction = (
      <Button variant="ghost" onClick={dismiss}>
        {t('decisions.proposals.votingIntroSkipAction')}
      </Button>
    );
  }

  return (
    <Dialog
      open={!isSeen}
      onOpenChange={(open) => {
        if (!open) {
          dismiss();
        }
      }}
    >
      <DialogContent showCloseButton={false}>
        {step.kind === 'budget' ? (
          <BudgetStep budget={step.budget} />
        ) : (
          <RankedStep budget={budget} />
        )}
        <div className="flex items-center px-6 py-4">
          {startAction}
          {isLastStep ? (
            <Button variant="outline" className="ms-auto" onClick={dismiss}>
              {t('decisions.proposals.votingIntroReadyAction')}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="ms-auto"
              onClick={() => setStepIndex(stepIndex + 1)}
            >
              {t('Next')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const IntroTitle = ({ children }: { children: ReactNode }) => (
  <DialogTitle className="px-6 pt-8 pb-4 text-center">{children}</DialogTitle>
);

const IntroDescription = ({ children }: { children: ReactNode }) => (
  <DialogDescription className="text-center text-base text-foreground">
    {children}
  </DialogDescription>
);

// Illustrative costs are shares of the voter budget, so they read in its unit.
const formatSampleCost = ({
  budget,
  share,
}: {
  budget: BallotBudget;
  share: number;
}) =>
  formatBallotAmount({
    amount: Math.round(budget.voterBudget * share),
    unit: budget.unit,
  });

type SampleBadge = {
  variant: ComponentProps<typeof Badge>['variant'];
  share: number;
  rotation: string;
};

const SAMPLE_BADGE_ROWS: { top: SampleBadge[]; bottom: SampleBadge[] } = {
  top: [
    { variant: 'accent', share: 0.085, rotation: '-rotate-4' },
    { variant: 'warning', share: 0.125, rotation: 'rotate-9' },
  ],
  bottom: [
    { variant: 'destructive', share: 0.15, rotation: '-rotate-2' },
    { variant: 'outline', share: 0.2, rotation: 'rotate-4' },
    { variant: 'success', share: 0.3, rotation: '-rotate-2' },
  ],
};

const BudgetStep = ({ budget }: { budget: BallotBudget }) => {
  const t = useTranslations('decisions.proposals');
  const renderBadge = ({ variant, share, rotation }: SampleBadge) => (
    <Badge
      key={variant}
      variant={variant}
      className={cn('border-border shadow-2xs', rotation)}
    >
      {formatSampleCost({ budget, share })}
    </Badge>
  );

  return (
    <>
      <IntroTitle>{t('votingIntroBudgetTitle')}</IntroTitle>
      <div className="flex flex-col items-center gap-8 px-6 pt-2 pb-6">
        <div aria-hidden className="flex h-12 flex-col items-center">
          <div className="flex items-end gap-3">
            {SAMPLE_BADGE_ROWS.top.map(renderBadge)}
          </div>
          <div className="-mt-1 flex items-start gap-1">
            {SAMPLE_BADGE_ROWS.bottom.map(renderBadge)}
          </div>
        </div>
        <IntroDescription>
          {t('votingIntroBudgetDescription', {
            amount: formatBallotAmount({
              amount: budget.voterBudget,
              unit: budget.unit,
            }),
          })}
        </IntroDescription>
      </div>
    </>
  );
};

const RankedStep = ({ budget }: { budget?: BallotBudget }) => {
  const t = useTranslations('decisions.proposals');
  // Back to front, so the first pick lands on top of the fan.
  const sampleCards = [
    {
      rank: 3,
      share: 0.3,
      className: 'translate-x-12 rotate-5 rtl:-translate-x-12 rtl:-rotate-5',
      title: t('votingIntroSampleTitle3'),
      description: t('votingIntroSampleDescription3'),
      author: t('votingIntroSampleAuthor3'),
    },
    {
      rank: 2,
      share: 0.2,
      title: t('votingIntroSampleTitle2'),
      description: t('votingIntroSampleDescription2'),
      author: t('votingIntroSampleAuthor2'),
    },
    {
      rank: 1,
      share: 0.15,
      className: '-translate-x-12 -rotate-5 rtl:translate-x-12 rtl:rotate-5',
      title: t('votingIntroSampleTitle1'),
      description: t('votingIntroSampleDescription1'),
      author: t('votingIntroSampleAuthor1'),
    },
  ];

  return (
    <>
      <IntroTitle>{t('votingIntroRankedTitle')}</IntroTitle>
      <div className="flex flex-col items-center gap-2 px-6 py-2">
        {/* The cards are laid out at full size and scaled down, so their type
            and spacing stay on the token scale. */}
        <div
          aria-hidden
          className="pointer-events-none relative h-32 w-full overflow-hidden"
        >
          <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center">
            <div className="grid scale-40">
              {sampleCards.map(
                ({ rank, share, className, title, description, author }) => (
                  <ProposalCard
                    key={rank}
                    className={cn(
                      'col-start-1 row-start-1 w-80 shadow-2xs',
                      className,
                    )}
                    title={title}
                    description={description}
                    budget={
                      budget ? formatSampleCost({ budget, share }) : undefined
                    }
                    authors={[{ name: author }]}
                    aside={
                      <RankCheckbox
                        rank={rank}
                        checked
                        readOnly
                        tabIndex={-1}
                      />
                    }
                  />
                ),
              )}
            </div>
          </div>
        </div>
        <IntroDescription>{t('votingIntroRankedDescription')}</IntroDescription>
      </div>
    </>
  );
};
