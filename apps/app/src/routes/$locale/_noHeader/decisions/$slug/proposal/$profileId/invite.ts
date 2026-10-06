import { acceptProposalInvite } from '@/server/decisions/proposalInvite';
import { methodNotAllowed } from '@/server/methodNotAllowed';
import { OPURLConfig } from '@op/core';
import { createFileRoute } from '@tanstack/react-router';

/** An invite link: accept the invite, then open the proposal editor. */
export const Route = createFileRoute(
  '/$locale/_noHeader/decisions/$slug/proposal/$profileId/invite',
)({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const proposalUrl = `${OPURLConfig('APP').ENV_URL}/decisions/${params.slug}/proposal/${params.profileId}/edit`;

        await acceptProposalInvite(params.profileId);

        return new Response(null, {
          status: 307,
          headers: { location: proposalUrl },
        });
      },
      ANY: methodNotAllowed(['GET']),
    },
  },
});
