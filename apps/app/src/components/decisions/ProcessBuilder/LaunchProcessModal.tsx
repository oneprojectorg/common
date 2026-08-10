'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Alert, AlertDescription } from '@op/sense/Alert';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { Skeleton } from '@op/sense/Skeleton';
import { toast } from '@op/sense/Toast';
import { LuTriangleAlert } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { useProcessBuilderStore } from './stores/useProcessBuilderStore';

export const LaunchProcessModal = ({
  isOpen,
  onOpenChange,
  instanceId,
  processName,
  decisionProfileId,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  instanceId: string;
  processName: string;
  decisionProfileId: string;
}) => {
  const t = useTranslations();
  const router = useRouter();
  const instanceData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );
  const clearInstance = useProcessBuilderStore((s) => s.clearInstance);

  const { data: invites, isLoading: invitesLoading } =
    trpc.profile.listProfileInvites.useQuery(
      { profileId: decisionProfileId },
      { enabled: isOpen },
    );
  const pendingNotificationCount =
    invites?.filter((i) => !i.notifiedAt).length ?? 0;

  const phasesCount = instanceData?.phases?.length ?? 0;
  const organizeByCategories =
    instanceData?.config?.organizeByCategories ?? true;
  const categoriesCount = instanceData?.config?.categories?.length ?? 0;
  const showNoCategoriesWarning = organizeByCategories && categoriesCount === 0;

  const utils = trpc.useUtils();

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: async (data) => {
      onOpenChange(false);
      // Leftover dirty fields would otherwise overlay the published instance
      clearInstance(decisionProfileId);
      await utils.decision.getDecisionBySlug.invalidate();
      router.push(`/decisions/${data.slug}`);
    },
    onError: (error) => {
      toast.error(error.message, {
        description: t('Failed to launch process'),
      });
    },
  });

  const handleLaunch = () => {
    updateInstance.mutate({
      instanceId,
      status: ProcessStatus.PUBLISHED,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Launch process?')}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 px-6 py-4">
          {invitesLoading ? (
            <Skeleton className="h-6 w-full" />
          ) : pendingNotificationCount > 0 ? (
            <p className="text-foreground">
              {t('Launching your process will notify')}{' '}
              <span className="font-bold">
                {t(
                  '{count, plural, =1 {1 participant} other {# participants}}.',
                  { count: pendingNotificationCount },
                )}
              </span>
            </p>
          ) : (
            <p className="text-foreground">
              {t(
                'This will open {processName} for proposal submissions. Participants will be notified and can begin submitting proposals.',
                { processName },
              )}
            </p>
          )}

          {/* Summary Section */}
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">{t('Phases')}</span>
              <span className="text-foreground">{phasesCount}</span>
            </div>
            {organizeByCategories && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('Categories')}</span>
                <span className="text-foreground">
                  {categoriesCount === 0 ? t('None') : categoriesCount}
                </span>
              </div>
            )}
          </div>

          <p className="text-sm text-foreground">
            {t('You can edit settings and advance phases after launching.')}
          </p>

          {showNoCategoriesWarning && (
            <Alert variant="warning">
              <LuTriangleAlert />
              <AlertDescription>
                {t(
                  "No proposal categories defined. Proposers won't be able to categorize their submissions.",
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {t('Cancel')}
          </Button>
          <Button
            onClick={handleLaunch}
            loading={updateInstance.isPending}
            disabled={updateInstance.isPending}
            className="w-full sm:w-auto"
          >
            {t('Launch Process')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
