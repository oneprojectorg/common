'use client';

import { useTRPC } from '@op/api/client';
import { toast } from '@op/sense/Toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  const removeAccess = useMutation(
    trpc.platform.admin.removeDecisionPublicAccess.mutationOptions({
      onSuccess: () => {
        toast.success(t('removePublicAccessSuccess'));
        queryClient.invalidateQueries(
          trpc.platform.admin.getDecisionInstance.queryFilter({ instanceId }),
        );
        setIsOpen(false);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    }),
  );

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
