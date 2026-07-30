'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { useMount } from '@op/hooks';
import { toast } from '@op/sense/Sonner';
import { createSBBrowserClient } from '@op/supabase/client';
import { useTransition } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

/**
 * Creates an empty draft proposal for the instance and navigates to the href
 * the caller builds from the created proposal. `isCreating` stays true through
 * the navigation so buttons can keep showing a pending state.
 *
 * Public (no-session) visitors get an anonymous session first when the process
 * grants them submit access, so the draft has an account to attribute to.
 */
export function useCreateProposal({
  instanceId,
  navigateTo,
  canSubmitProposal,
}: {
  instanceId: string;
  /** Builds the post-create destination from the new draft proposal. */
  navigateTo: (proposal: { profileId: string }) => string;
  /** Submit access for the viewer; permits anon sign-in for public visitors. */
  canSubmitProposal: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { user } = useUser();
  // Gate the CTA until mount so React Aria's onPress handler is bound.
  const { mounted } = useMount();
  const [isCreating, startCreating] = useTransition();
  const supabase = createSBBrowserClient();
  const utils = trpc.useUtils();

  const createProposalMutation = trpc.decision.createProposal.useMutation();

  const createProposal = () => {
    startCreating(async () => {
      try {
        // A public (no-session) visitor has no account to attribute the
        // proposal to, so give them an anonymous session before creating the
        // draft.
        if (canSubmitProposal && !user) {
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

        router.push(navigateTo(proposal));
      } catch (error) {
        toast.error(t('Failed to create proposal'), {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    });
  };

  return { createProposal, isCreating, isReady: !!mounted };
}
