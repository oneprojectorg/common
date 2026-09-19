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
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);

  const removeAccess =
    trpc.platform.admin.removeDecisionPublicAccess.useMutation({
      onSuccess: () => {
        toast.success(t('This decision is no longer public.'));
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
        label: t('Remove public access'),
        icon: <LuLock data-icon="inline-start" />,
        variant: 'destructive',
      }}
      title={t('Remove public access?')}
      description={t(
        'Visitors without an account lose access to this decision and everything in it. Anyone who already joined keeps their own access, and nothing they submitted is deleted.',
      )}
      confirm={{
        label: t('Remove access'),
        pendingLabel: t('Removing…'),
        variant: 'destructive',
      }}
      isPending={removeAccess.isPending}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onConfirm={() => removeAccess.mutate({ instanceId })}
    />
  );
};
