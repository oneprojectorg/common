'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { createSBBrowserClient } from '@op/supabase/client';
import { toast } from '@op/ui/Toast';
import { useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

/**
 * Creates an empty draft proposal for the instance and navigates to its edit
 * page. `isCreating` stays true through the redirect on success so buttons
 * can keep showing a pending state.
 *
 * Public (no-session) visitors are given an anonymous session first when the
 * `anonymous_signin` flag is on, so the draft has an account to attribute to.
 */
export function useCreateProposal({
  instanceId,
  decisionSlug,
}: {
  instanceId: string;
  decisionSlug: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const supabase = createSBBrowserClient();
  const utils = trpc.useUtils();
  const anonymousSigninEnabled = useFeatureFlag('anonymous_signin');

  const createProposalMutation = trpc.decision.createProposal.useMutation();

  const createProposal = async () => {
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
      router.push(
        `/decisions/${decisionSlug}/proposal/${proposal.profileId}/edit`,
      );
    } catch (error) {
      setIsCreating(false);
      toast.error({
        title: t('Failed to create proposal'),
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return { createProposal, isCreating };
}
