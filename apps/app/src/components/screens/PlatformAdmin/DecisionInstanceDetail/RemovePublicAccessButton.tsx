'use client';

import { trpc } from '@op/api/client';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuLock } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AdminActionConfirmation } from './AdminActionConfirmation';

export const RemovePublicAccessButton = ({
  instanceId,
}: {
  instanceId: string;
}) => {
  const t = useTranslations('admin');
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);

  const removeAccess =
    trpc.platform.admin.removeDecisionPublicAccess.useMutation({
      onSuccess: () => {
        toast.success(t('removePublicAccessSuccess'));
        utils.platform.admin.getDecisionInstance.invalidate({ instanceId });
        setIsOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });

  return (
    <AdminActionConfirmation
      trigger={{
        label: t('removePublicAccessAction'),
        icon: <LuLock data-icon="inline-start" />,
        variant: 'destructive',
      }}
      title={t('removePublicAccessConfirmTitle')}
      description={t('removePublicAccessConfirmHint')}
      confirm={{
        label: t('removeAccessAction'),
        pendingLabel: t('removingProgress'),
        variant: 'destructive',
      }}
      isPending={removeAccess.isPending}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onConfirm={() => removeAccess.mutate({ instanceId })}
    />
  );
};
