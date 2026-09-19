'use client';

import { trpc } from '@op/api/client';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuGlobe } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AdminActionConfirmation } from './AdminActionConfirmation';

/**
 * Platform-admin escape hatch: open a decision to the public. There is no
 * user-facing equivalent, and no reversal in the product — the confirmation
 * spells out what the grant admits.
 */
export const MakePublicButton = ({ instanceId }: { instanceId: string }) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);

  const makePublic = trpc.platform.admin.makeDecisionPublic.useMutation({
    onSuccess: () => {
      toast.success(t('This decision is now public.'));
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
        label: t('Make public'),
        icon: <LuGlobe data-icon="inline-start" />,
        variant: 'outline',
      }}
      title={t('Make this decision public?')}
      description={t(
        'Anyone with the link can then read this decision without an account, and anyone signed in can submit a proposal and vote. Proposals and comments already in the decision become readable too. There is no way to close it again from this screen.',
      )}
      confirm={{
        label: t('Make public'),
        pendingLabel: t('Publishing…'),
        variant: 'default',
      }}
      isPending={makePublic.isPending}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      onConfirm={() => makePublic.mutate({ instanceId })}
    />
  );
};
