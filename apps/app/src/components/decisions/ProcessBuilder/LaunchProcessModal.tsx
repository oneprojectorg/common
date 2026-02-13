'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import { LuInfo } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { useProcessBuilderStore } from './stores/useProcessBuilderStore';

export const LaunchProcessModal = ({
  isOpen,
  onOpenChange,
  instanceId,
  processName,
  slug,
  decisionProfileId,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  instanceId: string;
  processName: string;
  slug: string;
  decisionProfileId: string;
}) => {
  const t = useTranslations();
  const router = useRouter();
  const instanceData = useProcessBuilderStore(
    (s) => s.instances[decisionProfileId],
  );

  const phasesCount = instanceData?.phases?.length ?? 0;
  const categoriesCount = instanceData?.categories?.length ?? 0;
  const showNoCategoriesWarning = categoriesCount === 0;

  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => {
      onOpenChange(false);
      router.push(`/decisions/${slug}`);
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
      <ModalHeader>{t('Launch Process')}</ModalHeader>
      <ModalBody className="flex flex-col gap-4">
        <p className="text-neutral-charcoal">
          {t(
            'This will open {processName} for proposal submissions. Participants will be notified and can begin submitting proposals.',
            { processName },
          )}
        </p>

        {/* Summary Section */}
        <div className="flex flex-col gap-2 rounded-lg border border-neutral-gray1 p-4">
          <div className="flex items-center justify-between border-b border-neutral-gray1 pb-2">
            <span className="text-neutral-gray4">{t('Phases')}</span>
            <span className="text-neutral-charcoal">{phasesCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-neutral-gray4">{t('Categories')}</span>
            <span className="text-neutral-charcoal">
              {categoriesCount === 0 ? t('None') : categoriesCount}
            </span>
          </div>
        </div>

        <p className="text-sm text-neutral-charcoal">
          {t('You can edit settings and advance phases after launching.')}
        </p>

        {showNoCategoriesWarning && (
          <div className="flex items-start gap-1 rounded-lg border border-primary-orange1 bg-primary-orange1/[0.08] p-4">
            <LuInfo className="mt-0.5 size-4 shrink-0 text-primary-orange1" />
            <p className="text-primary-orange1">
              {t(
                "No proposal categories defined. Proposers won't be able to categorize their submissions.",
              )}
            </p>
          </div>
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
