'use client';

import { trpc } from '@op/api/client';
import { Checkbox } from '@op/sense/Checkbox';
import { Label } from '@op/sense/Label';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuGlobe } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AdminActionConfirmation } from './AdminActionConfirmation';

export const MakePublicButton = ({ instanceId }: { instanceId: string }) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const [isOpen, setIsOpen] = useState(false);
  const [canSubmitProposals, setCanSubmitProposals] = useState(true);
  const [canVote, setCanVote] = useState(true);

  const makePublic = trpc.platform.admin.makeDecisionPublic.useMutation({
    onSuccess: () => {
      toast.success(t('admin.makePublicSuccess'));
      utils.platform.admin.getDecisionInstance.invalidate({ instanceId });
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setCanSubmitProposals(true);
      setCanVote(true);
    }
  };

  return (
    <AdminActionConfirmation
      trigger={{
        label: t('admin.makePublicAction'),
        icon: <LuGlobe data-icon="inline-start" />,
        variant: 'outline',
      }}
      title={t('admin.makePublicConfirmTitle')}
      description={t('admin.makePublicConfirmHint')}
      confirm={{
        label: t('admin.makePublicAction'),
        pendingLabel: t('admin.publishingProgress'),
        variant: 'default',
      }}
      isPending={makePublic.isPending}
      isOpen={isOpen}
      onOpenChange={handleOpenChange}
      onConfirm={() =>
        makePublic.mutate({
          instanceId,
          permissions: {
            submitProposals: canSubmitProposals,
            vote: canVote,
          },
        })
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs tracking-wide text-muted-foreground uppercase">
          {t('admin.publicUsersCanLabel')}
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <Label className="flex items-center gap-2 font-normal text-muted-foreground">
            <Checkbox checked disabled />
            {t('admin.publicCanReadItem')}
          </Label>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={canSubmitProposals}
              disabled={makePublic.isPending}
              onCheckedChange={setCanSubmitProposals}
            />
            {t('admin.publicCanSubmitItem')}
          </Label>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={canVote}
              disabled={makePublic.isPending}
              onCheckedChange={setCanVote}
            />
            {t('Vote')}
          </Label>
        </div>
      </fieldset>
    </AdminActionConfirmation>
  );
};
