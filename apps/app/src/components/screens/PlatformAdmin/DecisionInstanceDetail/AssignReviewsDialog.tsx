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
  DialogTrigger,
} from '@op/sense/Dialog';
import { Label } from '@op/sense/Label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { toast } from '@op/ui/Toast';
import { useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

/**
 * Manually assign a reviewer to proposals in this phase. Proposals authored
 * by the selected reviewer are excluded (the server skips them anyway).
 */
export const AssignReviewsDialog = ({
  instanceId,
  phaseId,
  eligibleReviewers,
  proposals,
}: {
  instanceId: string;
  phaseId: string;
  eligibleReviewers: AdminEligibleReviewer[];
  proposals: AdminAssignableProposal[];
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(proposals.map((proposal) => proposal.id)),
  );

  // Fresh state each open: `proposals` may have been refetched since the last
  // assignment, and a previous session's reviewer/selection shouldn't linger.
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setReviewerId(null);
      setSelectedIds(new Set(proposals.map((proposal) => proposal.id)));
    }
    setIsOpen(open);
  };

  const reviewerItems = useMemo(
    () =>
      eligibleReviewers.map((reviewer) => ({
        value: reviewer.id,
        label: (
          <span className="flex items-baseline gap-2">
            {reviewer.name ?? reviewer.slug ?? reviewer.id}
            {reviewer.email ? (
              <span className="text-sm text-muted-foreground">
                {reviewer.email}
              </span>
            ) : null}
          </span>
        ),
      })),
    [eligibleReviewers],
  );

  const assignReviews = trpc.platform.admin.assignReviews.useMutation({
    onSuccess: ({ createdCount }) => {
      toast.success({
        message: t('{count} review assignments created', {
          count: createdCount,
        }),
      });
      utils.platform.admin.listDecisionReviewAssignments.invalidate({
        instanceId,
        phaseId,
      });
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error({ message: error.message });
    },
  });

  const assignableProposals = proposals.filter(
    (proposal) => proposal.submittedByProfileId !== reviewerId,
  );
  const selectedAssignableIds = assignableProposals
    .map((proposal) => proposal.id)
    .filter((id) => selectedIds.has(id));

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

  const allSelected =
    selectedAssignableIds.length === assignableProposals.length &&
    assignableProposals.length > 0;

  const toggleAll = () => {
    setSelectedIds(
      allSelected
        ? new Set()
        : new Set(assignableProposals.map((proposal) => proposal.id)),
    );
  };

  const canSubmit =
    !!reviewerId &&
    selectedAssignableIds.length > 0 &&
    !assignReviews.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button size="sm" disabled={eligibleReviewers.length === 0}>
            {t('Assign reviews')}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Assign reviews')}</DialogTitle>
          <DialogDescription>
            {t(
              'Assign the selected proposals to a reviewer. Existing assignments are kept as they are.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 py-4">
          <div className="flex flex-col gap-2">
            <Label>{t('Reviewer')}</Label>
            <Select
              items={reviewerItems}
              value={reviewerId}
              onValueChange={(value) => setReviewerId(value)}
            >
              <SelectTrigger className="w-full">
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
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label>
                {t('Proposals ({selected} of {total})', {
                  selected: selectedAssignableIds.length,
                  total: assignableProposals.length,
                })}
              </Label>
              <Button
                variant="ghost"
                size="xs"
                onClick={toggleAll}
                disabled={assignableProposals.length === 0}
              >
                {allSelected ? t('Clear') : t('Select all')}
              </Button>
            </div>
            <ul className="flex max-h-64 flex-col overflow-y-auto rounded-lg border">
              {proposals.map((proposal) => {
                const isOwnProposal =
                  proposal.submittedByProfileId === reviewerId;
                return (
                  <li key={proposal.id} className="border-b last:border-b-0">
                    <Label
                      className={`flex items-center gap-2.5 px-3 py-2 font-normal ${
                        isOwnProposal
                          ? 'text-muted-foreground'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={!isOwnProposal && selectedIds.has(proposal.id)}
                        disabled={isOwnProposal}
                        onCheckedChange={() => toggleProposal(proposal.id)}
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">
                          {proposal.title ?? t('Untitled Proposal')}
                        </span>
                        {proposal.author ? (
                          <span className="truncate text-sm text-muted-foreground">
                            {proposal.author.name ?? proposal.author.slug}
                          </span>
                        ) : null}
                      </span>
                      {isOwnProposal ? (
                        <Badge variant="outline" className="ms-auto shrink-0">
                          {t("Reviewer's own proposal")}
                        </Badge>
                      ) : null}
                    </Label>
                  </li>
                );
              })}
              {proposals.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {t('No proposals in this phase yet.')}
                </li>
              ) : null}
            </ul>
            {proposals.length > 0 && assignableProposals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  'This reviewer authored every proposal in this phase, so there is nothing to assign to them.',
                )}
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            {t('Cancel')}
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() => {
              if (!reviewerId) {
                return;
              }
              assignReviews.mutate({
                instanceId,
                phaseId,
                reviewerProfileId: reviewerId,
                proposalIds: selectedAssignableIds,
              });
            }}
          >
            {assignReviews.isPending ? t('Assigning…') : t('Assign')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
