'use client';

import { trpc } from '@op/api/client';
import { toast } from '@op/sense/Sonner';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { useState } from 'react';
import { LuFlag } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * Header "Report" action for the proposal view. Opens a confirmation dialog;
 * confirming sends the proposal for async moderation review via
 * `moderation.flagItem` (records a pending flag + submits to the provider). The
 * proposal stays visible until a verdict confirms it.
 */
export function ReportProposalDialog({ proposalId }: { proposalId: string }) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);

  const reportMutation = trpc.moderation.flagItem.useMutation({
    onSuccess: () => {
      toast.success(t('Proposal reported for moderation review'));
      setIsOpen(false);
    },
    onError: () => {
      toast.error(t('Could not report this proposal. Please try again.'));
    },
  });

  // Reflects a successful report this session — the trigger reads "Reported"
  // and disables so the reporter doesn't re-open the dialog.
  const reported = reportMutation.isSuccess;

  return (
    <>
      <Button
        surface="outline"
        color="secondary"
        size="small"
        onPress={() => setIsOpen(true)}
        isDisabled={reported}
      >
        <LuFlag className="size-4" />
        {reported ? t('Reported') : t('Report')}
      </Button>

      <Modal isDismissable isOpen={isOpen} onOpenChange={setIsOpen}>
        <ModalHeader>{t('Report this proposal')}</ModalHeader>
        <ModalBody>
          <p>
            {t(
              "This proposal will be sent to an independent moderation service for review. It stays visible while the review is in progress. If it violates Common's Code of Conduct, it will be hidden and the author will be notified.",
            )}
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            color="secondary"
            className="w-full sm:w-fit"
            onPress={() => setIsOpen(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            color="destructive"
            className="w-full sm:w-fit"
            onPress={() =>
              reportMutation.mutate({
                itemType: 'proposal',
                itemId: proposalId,
              })
            }
            isDisabled={reportMutation.isPending}
          >
            {t('Report')}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}
