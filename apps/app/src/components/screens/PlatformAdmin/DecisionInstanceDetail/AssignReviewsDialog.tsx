'use client';

import { trpc } from '@op/api/client';
import type {
  AdminAssignableProposal,
  AdminProfileRef,
} from '@op/common/client';
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@op/sense/Select';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';

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
  eligibleReviewers: AdminProfileRef[];
  proposals: AdminAssignableProposal[];
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const [reviewerId, setReviewerId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(proposals.map((proposal) => proposal.id)),
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

  const canSubmit =
    !!reviewerId &&
    selectedAssignableIds.length > 0 &&
    !assignReviews.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
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

        <div className="flex flex-col gap-4 px-6">
          <div className="flex flex-col gap-2">
            <Label>{t('Reviewer')}</Label>
            <Select
              value={reviewerId}
              onValueChange={(value) => setReviewerId(value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('Select a reviewer')} />
              </SelectTrigger>
              <SelectContent>
                {eligibleReviewers.map((reviewer) => (
                  <SelectItem key={reviewer.id} value={reviewer.id}>
                    {reviewer.name ?? reviewer.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>
              {t('Proposals ({selected} of {total})', {
                selected: selectedAssignableIds.length,
                total: assignableProposals.length,
              })}
            </Label>
            <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
              {assignableProposals.map((proposal) => (
                <li key={proposal.id}>
                  <Label className="flex items-center gap-2 font-normal">
                    <Checkbox
                      checked={selectedIds.has(proposal.id)}
                      onCheckedChange={() => toggleProposal(proposal.id)}
                    />
                    <span className="truncate">
                      {proposal.title ?? t('Untitled proposal')}
                    </span>
                  </Label>
                </li>
              ))}
              {assignableProposals.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  {t('No assignable proposals.')}
                </li>
              ) : null}
            </ul>
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
