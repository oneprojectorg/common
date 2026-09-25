'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuFlag } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

const COMPACT_TRIGGER = { variant: 'ghost', size: 'icon-sm' } as const;
const LABELLED_TRIGGER = {
  variant: 'outline',
  size: 'default',
  className: 'max-sm:size-11',
} as const;

/**
 * Header "Report" action for the proposal view. Opens a confirmation dialog;
 * confirming sends the proposal for async moderation review via
 * `moderation.flagItem` (records a pending flag + submits to the provider). The
 * proposal stays visible until a verdict confirms it.
 *
 * The trigger is icon-only below `sm` (the mobile read-view action row is a row
 * of icon buttons) and gains its label from `sm` up.
 */
export function ReportProposalDialog({
  proposalId,
  iconOnly = false,
}: {
  proposalId: string;
  /** Drop the label and the outline, for a header that is already icon buttons. */
  iconOnly?: boolean;
}) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  const reportMutation = trpc.moderation.flagItem.useMutation({
    onSuccess: () => {
      toast.success(t('decisions.proposals.reportSuccess'));
      setIsOpen(false);
    },
    onError: () => {
      toast.error(t('decisions.proposals.reportError'));
    },
  });

  // Reflects a successful report this session — the trigger reads "Reported"
  // and disables so the reporter doesn't re-open the dialog.
  const reported = reportMutation.isSuccess;
  const triggerLabel = reported
    ? t('decisions.proposals.reportedStatus')
    : t('posts.reportAction');

  return (
    <>
      <Button
        {...(iconOnly ? COMPACT_TRIGGER : LABELLED_TRIGGER)}
        onClick={() => setIsOpen(true)}
        disabled={reported}
        aria-label={triggerLabel}
      >
        <LuFlag className="size-4" />
        {iconOnly ? null : (
          <span className="hidden sm:inline">{triggerLabel}</span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('decisions.proposals.reportProposalTitle')}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4">
            <p className="text-base">
              {t('decisions.proposals.reportModerationNotice')}
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="w-full sm:w-fit"
              onClick={() => setIsOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              variant="destructive"
              className="w-full sm:w-fit"
              onClick={() =>
                reportMutation.mutate({
                  itemType: 'proposal',
                  itemId: proposalId,
                })
              }
              loading={reportMutation.isPending}
            >
              {t('posts.reportAction')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
