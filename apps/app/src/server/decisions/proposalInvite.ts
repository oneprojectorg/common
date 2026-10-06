import { createClient } from '@op/api/serverClient';
import '@tanstack/react-start/server-only';

/**
 * Accepts a proposal invite for the signed-in viewer. A failure is left for
 * the proposal page to surface as its natural access error.
 */
export async function acceptProposalInvite(profileId: string) {
  try {
    const client = await createClient();
    await client.decision.acceptProposalInvite({ profileId });
  } catch {
    // Redirect to the proposal page and let the natural access error occur
  }
}
