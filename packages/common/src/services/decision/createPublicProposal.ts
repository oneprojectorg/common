import type { User } from '@op/supabase/lib';

import { type CreateProposalInput, createProposal } from './createProposal';
import { joinInstance } from './joinInstance';

/**
 * Creates a proposal on a public decision instance for a caller who may not yet
 * be a member (anonymous sessions and logged-in non-members alike): ensures
 * membership via {@link joinInstance} (which gates on the public being allowed
 * to submit proposals here and no-ops for existing members), then delegates to
 * {@link createProposal}.
 */
export const createPublicProposal = async ({
  data,
  user,
}: {
  data: CreateProposalInput;
  user: User;
}) => {
  await joinInstance({
    processInstanceId: data.processInstanceId,
    user,
    requiredPermission: 'submitProposals',
  });

  return createProposal({ data, user });
};
