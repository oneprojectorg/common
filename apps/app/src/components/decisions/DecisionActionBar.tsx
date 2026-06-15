'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { createSBBrowserClient } from '@op/supabase/client';
import { Button } from '@op/ui/Button';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { RichTextViewer } from '@op/ui/RichTextEditor';
import { toast } from '@op/ui/Toast';
import he from 'he';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { getViewerExtensions } from '../RichTextEditor/editorConfig';

export const DecisionActionBar = ({
  instanceId,
  description,
  label,
  markup = false,
  showSubmitButton = false,
}: {
  instanceId: string;
  description?: string;
  label?: string;
  markup?: boolean;
  showSubmitButton?: boolean;
}) => {
  const t = useTranslations();
  const { slug } = useParams();
  const router = useRouter();
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const supabase = createSBBrowserClient();
  const utils = trpc.useUtils();
  const anonymousSigninEnabled = useFeatureFlag('anonymous_signin');

  const createProposalMutation = trpc.decision.createProposal.useMutation();

  const handleCreateProposal = async () => {
    setIsCreating(true);

    try {
      // A public (no-session) visitor has no account to attribute the proposal
      // to, so give them an anonymous session before creating the draft.
      if (anonymousSigninEnabled && !user) {
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          throw error;
        }

        // The new session isn't reflected in the cached account query, so
        // refetch it before navigating — the edit page requires a populated
        // user in context.
        await utils.account.getMyAccount.invalidate();
      }

      const proposal = await createProposalMutation.mutateAsync({
        processInstanceId: instanceId,
        proposalData: {}, // Empty draft - user will fill in via edit page
      });

      // Navigate to edit the newly created draft proposal
      router.push(`/decisions/${slug}/proposal/${proposal.profileId}/edit`);
    } catch (error) {
      setIsCreating(false);
      toast.error({
        title: t('Failed to create proposal'),
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <div className="flex w-full justify-center">
      <div className="flex w-full max-w-[12rem] flex-col items-center justify-center gap-4 sm:flex-row">
        {description ? (
          <DialogTrigger>
            <Button color="secondary" className="w-full">
              {label ?? t('Learn more')}
            </Button>

            <Modal isDismissable className="sm:max-w-3xl">
              <Dialog>
                <ModalHeader>{label ?? t('About the process')}</ModalHeader>
                <ModalBody>
                  {markup && description ? (
                    <div
                      dir="auto"
                      className="prose max-w-none prose-gray"
                      dangerouslySetInnerHTML={{
                        __html: he.decode(description),
                      }}
                    />
                  ) : (
                    <RichTextViewer
                      extensions={getViewerExtensions()}
                      content={description}
                      editorClassName="prose prose-base max-w-none [&_p]:text-base"
                    />
                  )}
                </ModalBody>
              </Dialog>
            </Modal>
          </DialogTrigger>
        ) : null}

        {showSubmitButton && (
          <Button
            color="primary"
            className="w-full"
            isDisabled={isCreating}
            onPress={handleCreateProposal}
          >
            {isCreating ? <LoadingSpinner /> : null}
            {t('Start a proposal')}
          </Button>
        )}
      </div>
    </div>
  );
};
