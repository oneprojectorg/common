'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { AlertBanner } from '@op/ui/AlertBanner';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { Skeleton } from '@op/ui/Skeleton';
import { toast } from '@op/ui/Toast';

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
      await utils.decision.getDecisionBySlug.invalidate();
      router.push(`/decisions/${data.slug}`);
    },
    onError: (error) => {
      toast.error({
        message: t('Failed to launch process'),
        title: error.message,
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
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <ModalHeader>{t('Launch process?')}</ModalHeader>
      <ModalBody className="flex flex-col gap-4">
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
          <AlertBanner intent="warning">
            {t(
              "No proposal categories defined. Proposers won't be able to categorize their submissions.",
            )}
          </AlertBanner>
        )}
      </ModalBody>
      <ModalFooter>
        <Button
          color="neutral"
          onPress={() => onOpenChange(false)}
          className="w-full sm:w-auto"
        >
          {t('Cancel')}
        </Button>
        <Button
          onPress={handleLaunch}
          isPending={updateInstance.isPending}
          isDisabled={updateInstance.isPending}
          className="w-full sm:w-auto"
        >
          {t('Launch Process')}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
