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
import { toast } from '@op/sense/Sonner';

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
      toast.success(t('Reported for moderation review'));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('Could not report this content. Please try again.'));
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Report this comment')}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <p>
            {t(
              "This comment will be sent to an independent moderation service for review. It stays visible while the review is in progress. If it violates Common's Code of Conduct, it will be hidden and the author will be notified.",
            )}
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            onClick={() => onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            variant="destructive"
            className="w-full sm:w-fit"
            onClick={() =>
              reportMutation.mutate({ itemType: 'post', itemId: postId })
            }
            disabled={reportMutation.isPending}
          >
            {t('Report')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
