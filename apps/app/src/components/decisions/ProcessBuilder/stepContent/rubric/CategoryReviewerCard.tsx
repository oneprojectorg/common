'use client';

import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import type { RouterOutput } from '@op/api';
import { trpc } from '@op/api/client';
import { logger } from '@op/logging/client';
import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Button } from '@op/sense/Button';
import {
  Combobox,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from '@op/sense/Combobox';
import { toast } from '@op/sense/Toast';
import { usePostHog } from 'posthog-js/react';
import { useMemo } from 'react';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/** Picker option: `{ value, label }` so base-ui resolves the label automatically. */
type ReviewerOption = { value: string; label: string };

type CategoryWithReviewers =
  RouterOutput['decision']['listCategoryReviewers']['categories'][number];
type EligibleReviewer =
  RouterOutput['decision']['listEligibleReviewers']['reviewers'][number];

export interface CategoryReviewerCardProps {
  processInstanceId: string;
  category: CategoryWithReviewers['category'];
  reviewers: CategoryWithReviewers['reviewers'];
  eligibleReviewers: EligibleReviewer[];
}

/**
 * One flat category card: label + reviewer count, an "Add reviewer…" picker
 * scoped to REVIEW role-holders, and removable reviewer chips. Assign-only —
 * adding/removing only writes/deletes the scope row (PR 7); it never grants a
 * role or retracts materialized assignments.
 */
export function CategoryReviewerCard({
  processInstanceId,
  category,
  reviewers,
  eligibleReviewers,
}: CategoryReviewerCardProps) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const posthog = usePostHog();

  const invalidate = () =>
    utils.decision.listCategoryReviewers.invalidate({ processInstanceId });

  const addReviewer = trpc.decision.addCategoryReviewer.useMutation({
    onError: (error) => {
      logger.error('Failed to add category reviewer', { error });
      toast.error(t('Could not add reviewer. Please try again.'));
    },
    onSettled: () => {
      void invalidate();
    },
  });

  const removeReviewer = trpc.decision.removeCategoryReviewer.useMutation({
    onError: (error) => {
      logger.error('Failed to remove category reviewer', { error });
      toast.error(t('Could not remove reviewer. Please try again.'));
    },
    onSettled: () => {
      void invalidate();
    },
  });

  // Candidates for this card: eligible role-holders not already assigned here,
  // so the same set can never be double-added. The in-flight add is excluded
  // too, so it can't be re-picked before the refetch reflects it.
  const options = useMemo<ReviewerOption[]>(() => {
    const assignedIds = new Set(reviewers.map((r) => r.reviewerProfileId));
    const pendingId = addReviewer.isPending
      ? addReviewer.variables?.reviewerProfileId
      : undefined;
    return eligibleReviewers
      .filter(
        (reviewer) =>
          !assignedIds.has(reviewer.id) && reviewer.id !== pendingId,
      )
      .map((reviewer) => ({ value: reviewer.id, label: reviewer.name }));
  }, [
    eligibleReviewers,
    reviewers,
    addReviewer.isPending,
    addReviewer.variables,
  ]);

  const handleAdd = (selected: ReviewerOption[]) => {
    // One add at a time — a second concurrent mutate would race the unique
    // constraint and surface a spurious error toast.
    if (addReviewer.isPending) {
      return;
    }
    const added = selected[selected.length - 1];
    if (!added) {
      return;
    }
    posthog.capture(
      'category_reviewer_added',
      getDecisionCommonProperties({
        decisionInstanceId: processInstanceId,
        additionalProps: {
          category_id: category.id,
          reviewer_profile_id: added.value,
        },
      }),
    );
    addReviewer.mutate({
      processInstanceId,
      taxonomyTermId: category.id,
      reviewerProfileId: added.value,
    });
  };

  const count = reviewers.length;
  const isEmpty = count === 0;

  return (
    <div
      className="flex w-full flex-col gap-2"
      data-testid={`category-reviewer-card-${category.name}`}
    >
      <div className="flex items-end justify-between gap-2">
        <span className="font-serif text-title-sm14 text-foreground">
          {category.name}
        </span>
        <span
          className={
            isEmpty
              ? 'text-sm text-primary-orange2'
              : 'text-sm text-muted-foreground'
          }
        >
          {t(
            '{count, plural, =0 {0 reviewers} =1 {1 reviewer} other {# reviewers}}',
            {
              count,
            },
          )}
        </span>
      </div>

      {/* Assign picker: multi-select whose value stays empty — assigned
          reviewers render as removable rows below, not as combobox chips. */}
      <Combobox multiple items={options} value={[]} onValueChange={handleAdd}>
        <ComboboxChips>
          <ComboboxChipsInput placeholder={t('Add reviewer…')} />
        </ComboboxChips>
        <ComboboxContent>
          <ComboboxEmpty>{t('No results')}</ComboboxEmpty>
          <ComboboxList>
            {(item: ReviewerOption) => (
              <ComboboxItem key={item.value} value={item}>
                {item.label}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      {isEmpty ? (
        <p className="text-sm text-primary-orange2">
          {t(
            'No reviewers yet. Proposals in this category can’t be reviewed until someone is added.',
          )}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {reviewers.map((reviewer) => {
            const isRemoving =
              removeReviewer.isPending &&
              removeReviewer.variables?.reviewerProfileId ===
                reviewer.reviewerProfileId;

            return (
              <div
                key={reviewer.scopeId}
                className="flex items-center gap-6 rounded-lg border border-border bg-white px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="size-6 shrink-0">
                    <AvatarFallback name={reviewer.profile.name} />
                  </Avatar>
                  <span className="text-base text-foreground">
                    {reviewer.profile.name}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  loading={isRemoving}
                  onClick={() => {
                    posthog.capture(
                      'category_reviewer_removed',
                      getDecisionCommonProperties({
                        decisionInstanceId: processInstanceId,
                        additionalProps: {
                          category_id: category.id,
                          reviewer_profile_id: reviewer.reviewerProfileId,
                        },
                      }),
                    );
                    removeReviewer.mutate({
                      processInstanceId,
                      taxonomyTermId: category.id,
                      reviewerProfileId: reviewer.reviewerProfileId,
                    });
                  }}
                  aria-label={t('Remove {name}', {
                    name: reviewer.profile.name,
                  })}
                >
                  <LuX className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
