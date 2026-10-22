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
      toast.success(t('posts.reportSuccess'));
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t('posts.reportError'));
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('posts.reportCommentTitle')}</DialogTitle>
        </DialogHeader>
        <div className="px-6 py-4">
          <p>{t('posts.reportCommentBody')}</p>
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
            {t('posts.reportAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
