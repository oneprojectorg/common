'use client';

import { trpc } from '@op/api/client';
import { Alert, AlertDescription } from '@op/sense/Alert';
import { useQueryState } from 'nuqs';
import { Suspense } from 'react';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ErrorMessage } from '@/components/ErrorMessage';

import { CategoryReviewerCard } from './CategoryReviewerCard';

export interface CategoryReviewerCardsProps {
  instanceId: string;
}

/**
 * By-category reviewer assignment for the Reviews step. Rendered only when the
 * Scope radio is set to `by_category`. Wraps its suspense-loaded content in a
 * local error boundary so a cards failure never takes down the Scope radio.
 */
export function CategoryReviewerCards({
  instanceId,
}: CategoryReviewerCardsProps) {
  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense fallback={<CategoryReviewerCardsSkeleton />}>
        <CategoryReviewerCardsContent instanceId={instanceId} />
      </Suspense>
    </ErrorBoundary>
  );
}

function CategoryReviewerCardsContent({
  instanceId,
}: CategoryReviewerCardsProps) {
  const t = useTranslations();
  const [, setSection] = useQueryState('section', { history: 'push' });

  const [{ categories }] = trpc.decision.listCategoryReviewers.useSuspenseQuery(
    {
      processInstanceId: instanceId,
    },
  );
  const [{ reviewers: eligibleReviewers }] =
    trpc.decision.listEligibleReviewers.useSuspenseQuery({
      processInstanceId: instanceId,
    });

  // No categories to scope reviewers to yet — point the admin at the
  // Proposal Categories section to define them first.
  if (categories.length === 0) {
    return (
      <Alert variant="warning">
        <LuCircleAlert />
        <AlertDescription>
          {t.rich(
            'No categories found. Add them in <link>Proposal Categories</link> to assign reviewers by category.',
            {
              link: (chunks: React.ReactNode) => (
                <button
                  type="button"
                  className="text-primary-teal underline"
                  onClick={() => void setSection('proposalCategories')}
                >
                  {chunks}
                </button>
              ),
            },
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {eligibleReviewers.length === 0 ? (
        // Replaces the intro entirely — the intro invites adding reviewers,
        // which contradicts an alert saying no one can review yet.
        <Alert variant="warning">
          <LuCircleAlert />
          <AlertDescription>
            {t.rich(
              'No participants can review yet. Grant review access in <link>Manage Participants</link> to add reviewers here.',
              {
                link: (chunks: React.ReactNode) => (
                  <button
                    type="button"
                    className="text-primary-teal underline"
                    onClick={() => void setSection('participants')}
                  >
                    {chunks}
                  </button>
                ),
              },
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <p className="text-base text-neutral-black">
          {t.rich(
            'Categories come from <link>Proposal Categories</link>. Add reviewers to each, or invite someone new.',
            {
              link: (chunks: React.ReactNode) => (
                <button
                  type="button"
                  className="text-primary-teal underline"
                  onClick={() => void setSection('proposalCategories')}
                >
                  {chunks}
                </button>
              ),
            },
          )}
        </p>
      )}

      {categories.map((entry) => (
        <CategoryReviewerCard
          key={entry.category.id}
          processInstanceId={instanceId}
          category={entry.category}
          reviewers={entry.reviewers}
          eligibleReviewers={eligibleReviewers}
        />
      ))}
    </div>
  );
}

function CategoryReviewerCardsSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6">
      <div className="h-4 w-80 rounded bg-neutral-gray1" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="h-4 w-40 rounded bg-neutral-gray1" />
            <div className="h-4 w-20 rounded bg-neutral-gray1" />
          </div>
          <div className="h-10 w-full rounded-lg bg-neutral-gray1" />
        </div>
      ))}
    </div>
  );
}
