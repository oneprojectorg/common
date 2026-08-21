'use client';

import { trpc } from '@op/api/client';
import type {
  AdminAssignableProposal,
  AdminEligibleReviewer,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Field, FieldGroup, FieldLabel } from '@op/sense/Field';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
import { ScrollArea } from '@op/sense/ScrollArea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useId, useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { SelectionCategoryChips } from '../selection/SelectionCategoryChips';

/**
 * Bulk-assign proposals to one reviewer. Mounted only while open, so every
 * open starts from a clean reviewer + selection. Rows the selected reviewer
 * already has (and their own proposals) are listed but disabled — re-assigning
 * is an idempotent no-op server-side, so the disabling is UX only.
 */
export function AssignProposalsDialog({
  processInstanceId,
  phaseId,
  eligibleReviewers,
  proposals,
  reviewerIdsByProposalId,
  initialReviewerProfileId,
  onClose,
}: {
  processInstanceId: string;
  phaseId: string;
  eligibleReviewers: AdminEligibleReviewer[];
  /** Every assignable proposal in the phase. */
  proposals: AdminAssignableProposal[];
  /** Reviewers already assigned per proposal — coverage hint + disabled rows. */
  reviewerIdsByProposalId: ReadonlyMap<string, string[]>;
  /** Pre-scopes the reviewer when opened from a reviewer row. */
  initialReviewerProfileId: string | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const filterId = useId();
  const reviewerSelectId = useId();

  const [reviewerId, setReviewerId] = useState<string | null>(() =>
    // A stale render can hand over an ineligible reviewer — never open
    // pre-scoped to someone the server would reject.
    initialReviewerProfileId &&
    eligibleReviewers.some(
      (reviewer) => reviewer.id === initialReviewerProfileId,
    )
      ? initialReviewerProfileId
      : null,
  );
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );

  const assignReviews = trpc.decision.assignReviews.useMutation({
    onSuccess: ({ createdCount }) => {
      toast.success(
        t(
          '{count, plural, one {# review assignment created} other {# review assignments created}}',
          { count: createdCount },
        ),
      );
      utils.decision.listPhaseReviewAssignments.invalidate({
        processInstanceId,
        phaseId,
      });
      onClose();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const reviewerItems = useMemo(
    () =>
      eligibleReviewers.map((reviewer) => ({
        value: reviewer.id,
        label: reviewer.name ?? reviewer.slug ?? reviewer.email ?? reviewer.id,
      })),
    [eligibleReviewers],
  );

  // Rows are listed either way; `blockedBy` is what makes one uncheckable.
  const rows = useMemo(
    () =>
      proposals.map((proposal) => {
        const assignedReviewerIds =
          reviewerIdsByProposalId.get(proposal.id) ?? [];
        return {
          proposal,
          reviewerCount: assignedReviewerIds.length,
          blockedBy: resolveBlocker({
            proposal,
            reviewerId,
            assignedReviewerIds,
          }),
        };
      }),
    [proposals, reviewerId, reviewerIdsByProposalId],
  );

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return rows;
    }
    return rows.filter(
      (row) =>
        (row.proposal.title ?? '').toLowerCase().includes(needle) ||
        row.proposal.categories.some((category) =>
          category.label.toLowerCase().includes(needle),
        ),
    );
  }, [rows, query]);

  const selectableIds = rows
    .filter((row) => row.blockedBy === null)
    .map((row) => row.proposal.id);

  // Submitted set spans the whole pool, not just what the filter shows, so
  // "filter → select all → filter again → select all → assign" accumulates.
  const selectedAssignableIds = selectableIds.filter((id) =>
    selectedIds.has(id),
  );

  const selectableVisibleIds = visibleRows
    .filter((row) => row.blockedBy === null)
    .map((row) => row.proposal.id);

  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => selectedIds.has(id));

  const toggleProposal = (proposalId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(proposalId)) {
        next.delete(proposalId);
      } else {
        next.add(proposalId);
      }
      return next;
    });
  };

  // Scoped to the current filter: that is the bulk gesture this desk is for.
  const toggleAllVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of selectableVisibleIds) {
        if (allVisibleSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  };

  const canSubmit =
    !!reviewerId &&
    selectedAssignableIds.length > 0 &&
    !assignReviews.isPending;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Assign proposals')}</DialogTitle>
          <DialogDescription>
            {t(
              'Assignments appear in the reviewer\'s "{queue}" for this phase.',
              {
                queue: t('Proposals to review'),
              },
            )}
          </DialogDescription>
        </DialogHeader>

        <FieldGroup className="px-6 py-4">
          <Field>
            <FieldLabel htmlFor={reviewerSelectId}>{t('Reviewer')}</FieldLabel>
            <Select
              items={reviewerItems}
              value={reviewerId}
              onValueChange={(value) => setReviewerId(value)}
            >
              <SelectTrigger id={reviewerSelectId} className="w-full">
                <SelectValue placeholder={t('Select a reviewer')} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {reviewerItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <div className="flex items-center justify-between gap-3">
              <FieldLabel htmlFor={filterId}>
                {t('Proposals ({selected} of {total} selected)', {
                  selected: selectedAssignableIds.length,
                  total: selectableIds.length,
                })}
              </FieldLabel>
              <Button
                variant="ghost"
                onClick={toggleAllVisible}
                disabled={selectableVisibleIds.length === 0}
              >
                {allVisibleSelected ? t('Clear') : t('Select all')}
              </Button>
            </div>

            <Input
              id={filterId}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Filter by title or category…')}
            />

            {/* The live region is this count, not the list — announcing the
                list re-read every row on each filter keystroke. */}
            <p aria-live="polite" className="sr-only">
              {t(
                '{count, plural, one {# proposal shown} other {# proposals shown}}',
                { count: visibleRows.length },
              )}
            </p>

            {/* The height cap targets the viewport, not the root: Base UI's
                viewport is `h-full`, which resolves to auto inside an
                auto-height root, so a root-level `max-h-64` would spill
                instead of scroll. */}
            <ScrollArea className="rounded-lg border [&>[data-slot=scroll-area-viewport]]:max-h-64">
              <ul className="flex flex-col">
                {visibleRows.map(({ proposal, reviewerCount, blockedBy }) => {
                  const isBlocked = blockedBy !== null;
                  const authorName = proposal.author
                    ? (proposal.author.name ?? proposal.author.slug)
                    : null;

                  return (
                    <li key={proposal.id} className="border-b last:border-b-0">
                      <Label
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 font-normal',
                          isBlocked
                            ? 'text-muted-foreground'
                            : 'hover:bg-muted/50',
                        )}
                      >
                        <Checkbox
                          checked={!isBlocked && selectedIds.has(proposal.id)}
                          disabled={isBlocked}
                          onCheckedChange={() => toggleProposal(proposal.id)}
                        />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate">
                            {proposal.title ?? t('Untitled Proposal')}
                          </span>
                          {authorName || reviewerCount > 0 ? (
                            <span className="flex min-w-0 items-baseline gap-2 text-sm text-muted-foreground">
                              {authorName ? (
                                <span className="truncate">{authorName}</span>
                              ) : null}
                              {reviewerCount > 0 ? (
                                <span className="shrink-0">
                                  {t(
                                    '{count, plural, one {# reviewer} other {# reviewers}}',
                                    { count: reviewerCount },
                                  )}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </span>
                        {/* Trailing cluster: this list's equivalent of the
                          table's category column. */}
                        {proposal.categories.length > 0 ? (
                          <span className="ms-auto flex shrink-0">
                            <SelectionCategoryChips
                              labels={proposal.categories.map(
                                (category) => category.label,
                              )}
                            />
                          </span>
                        ) : null}
                        {blockedBy ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'shrink-0',
                              proposal.categories.length === 0 && 'ms-auto',
                            )}
                          >
                            {blockedBy === 'own-proposal'
                              ? t("Reviewer's own proposal")
                              : t('Already assigned')}
                          </Badge>
                        ) : null}
                      </Label>
                    </li>
                  );
                })}
                {visibleRows.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    {proposals.length === 0
                      ? t('No proposals in this phase yet.')
                      : t('No proposals match "{query}".', {
                          query: query.trim(),
                        })}
                  </li>
                ) : null}
              </ul>
            </ScrollArea>
          </Field>
        </FieldGroup>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => {
              if (!reviewerId) {
                return;
              }
              assignReviews.mutate({
                processInstanceId,
                phaseId,
                reviewerProfileId: reviewerId,
                proposalIds: selectedAssignableIds,
              });
            }}
          >
            {assignReviews.isPending
              ? t('Assigning…')
              : t(
                  '{count, plural, one {Assign # proposal} other {Assign # proposals}}',
                  { count: selectedAssignableIds.length },
                )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Why a row can't be checked for the selected reviewer, `null` when it can. */
type Blocker = 'own-proposal' | 'already-assigned';

function resolveBlocker({
  proposal,
  reviewerId,
  assignedReviewerIds,
}: {
  proposal: AdminAssignableProposal;
  reviewerId: string | null;
  assignedReviewerIds: string[];
}): Blocker | null {
  if (reviewerId === null) {
    return null;
  }
  if (proposal.submittedByProfileId === reviewerId) {
    return 'own-proposal';
  }
  if (assignedReviewerIds.includes(reviewerId)) {
    return 'already-assigned';
  }
  return null;
}
