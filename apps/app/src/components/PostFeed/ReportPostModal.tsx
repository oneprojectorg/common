'use client';

import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';

import { useTranslations } from '@/lib/i18n';

/**
 * Confirmation dialog for reporting a post/comment. Confirming sends it for
 * async moderation review via `moderation.flagItem` (itemType `post` covers
 * comments) — the same flow the proposal header "Report" uses. The content
 * stays visible until a verdict confirms it.
 */
export function ReportPostModal({
  postId,
  isOpen,
  onOpenChange,
}: {
  postId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const t = useTranslations();

  const reportMutation = trpc.moderation.flagItem.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Reported for moderation review') });
      onOpenChange(false);
    },
    onError: () => {
      toast.error({
        message: t('Could not report this content. Please try again.'),
      });
    },
  });

  return (
    <Modal isDismissable isOpen={isOpen} onOpenChange={onOpenChange}>
      <ModalHeader>{t('Report this comment')}</ModalHeader>
      <ModalBody>
        <p>
          {t(
            "This comment will be sent to an independent moderation service for review. It stays visible while the review is in progress. If it violates Common's Code of Conduct, it will be hidden and the author will be notified.",
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button
          color="secondary"
          className="w-full sm:w-fit"
          onPress={() => onOpenChange(false)}
        >
          {t('Cancel')}
        </Button>
        <Button
          color="destructive"
          className="w-full sm:w-fit"
          onPress={() =>
            reportMutation.mutate({ itemType: 'post', itemId: postId })
          }
          isDisabled={reportMutation.isPending}
        >
          {t('Report')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
