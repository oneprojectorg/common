'use client';
import { useUser } from '@/utils/UserProvider';
import { useTRPC } from '@op/api/client';
import { useMount } from '@op/hooks';
import { toast } from '@op/sense/Toast';
import { createSBBrowserClient } from '@op/supabase/client';
import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
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
  const trpc = useTRPC();
  const t = useTranslations();
  const router = useRouter();
  const { user } = useUser();
  // Gate the CTA until mount: creating a proposal is entirely client-side, and
  // React does not replay a click that lands before hydration, so an enabled
  // button would be a silent no-op.
  const { mounted } = useMount();
  const [isCreating, startCreating] = useTransition();
  const supabase = createSBBrowserClient();
  const queryClient = useQueryClient();

  const createProposalMutation = useMutation(
    trpc.decision.createProposal.mutationOptions(),
  );

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
          await queryClient.invalidateQueries(
            trpc.account.getMyAccount.pathFilter(),
          );
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
