'use client';

import { trpc } from '@op/api/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@op/sense/AlertDialog';
import { Button } from '@op/sense/Button';
import { toast } from '@op/sense/Toast';
import { useState } from 'react';
import { LuGlobe } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

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
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger render={<Button variant="outline" size="sm" />}>
        <LuGlobe data-icon="inline-start" />
        {t('Make public')}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Make this decision public?')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'Anyone with the link can then read this decision without an account, and anyone signed in can submit a proposal and vote. Proposals and comments already in the decision become readable too. There is no way to close it again from this screen.',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={makePublic.isPending}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={makePublic.isPending}
            onClick={() => makePublic.mutate({ instanceId })}
          >
            {makePublic.isPending ? t('Publishing…') : t('Make public')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
