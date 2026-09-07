import { db, eq, inArray } from '@op/db/client';
import {
  authUsers,
  decisionProcessResultSelections,
  stateTransitionHistory,
} from '@op/db/schema';

import { hasEmail } from '../../utils/email';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import {
  type ResultNotificationMessages,
  type ResultNotificationValues,
  formatResultAmount,
  resultNotificationMessagesSchema,
} from './resultNotificationTemplate';
import type { TransitionData } from './schemas/transitionData';
import { isProposalReachable } from './utils/proposal';

export type ResultNotificationOutcome = 'funded' | 'notFunded';

export interface ResultNotificationRecipient {
  email: string;
  /** App URLs address a proposal by its profile id, not its own id. */
  proposalProfileId: string;
  outcome: ResultNotificationOutcome;
  /** The `{{...}}` substitutions for this recipient's copy of the message. */
  values: ResultNotificationValues;
}

export interface ResultNotification {
  processTitle: string;
  processProfileSlug: string;
  messages: ResultNotificationMessages;
  recipients: Array<ResultNotificationRecipient>;
}

export type ListResultNotificationRecipientsResult =
  | { ok: true; notification: ResultNotification }
  | {
      ok: false;
      reason:
        | 'resultRetired'
        | 'instanceUnavailable'
        | 'messagesMissing'
        | 'noRecipients';
    };

/**
 * Who hears how the decision went, and the copy they need. Addresses the exact
 * `decision_process_results` row that was published rather than "the latest
 * successful one": `revertPhase` retires rows by flipping `success`, and
 * re-resolving after a revert would read an empty selection set and tell every
 * author they were not funded.
 *
 * Empty outcomes return a reason rather than throwing. Nothing to authorize:
 * the audience is derived, not requested.
 */
export async function listResultNotificationRecipients({
  processInstanceId,
  processResultId,
  transitionHistoryId,
  previousPhaseId,
}: {
  processInstanceId: string;
  processResultId: string;
  transitionHistoryId: string;
  /** The phase whose membership defines the not-funded audience. */
  previousPhaseId: string;
}): Promise<ListResultNotificationRecipientsResult> {
  const [resultRow, instance, messages] = await Promise.all([
    db.query.decisionProcessResults.findFirst({
      where: { id: processResultId, processInstanceId },
    }),
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      with: { profile: true },
    }),
    readComposedMessages(transitionHistoryId),
  ]);

  // Retracted inside the debounce window, or never ours to begin with.
  if (!resultRow?.success) {
    return { ok: false, reason: 'resultRetired' };
  }

  if (!instance?.profile) {
    return { ok: false, reason: 'instanceUnavailable' };
  }

  if (!messages) {
    return { ok: false, reason: 'messagesMissing' };
  }

  const [selections, candidateIds] = await Promise.all([
    db
      .select({
        proposalId: decisionProcessResultSelections.proposalId,
        allocated: decisionProcessResultSelections.allocated,
      })
      .from(decisionProcessResultSelections)
      .where(
        eq(decisionProcessResultSelections.processResultId, processResultId),
      ),
    getProposalIdsForPhase({ instance, phaseId: previousPhaseId }),
  ]);

  const allocatedByProposalId = new Map(
    selections.map(({ proposalId, allocated }) => [proposalId, allocated]),
  );
  // Funded comes from the result row, not from the candidate pool: a proposal
  // created inside the final phase's own window can be selected without ever
  // belonging to the previous phase.
  const notFundedIds = candidateIds.filter(
    (id) => !allocatedByProposalId.has(id),
  );
  const proposalIds = [...allocatedByProposalId.keys(), ...notFundedIds];

  if (proposalIds.length === 0) {
    return { ok: false, reason: 'noRecipients' };
  }

  const proposals = await db.query.proposals.findMany({
    where: { id: { in: proposalIds } },
    with: { profile: { with: { profileUsers: true } } },
  });

  const reachable = proposals.filter(isProposalReachable);
  const currentEmails = await readCurrentEmails(
    reachable.flatMap((proposal) =>
      proposal.profile.profileUsers.map(({ authUserId }) => authUserId),
    ),
  );

  const recipients = reachable.flatMap((proposal) =>
    toRecipients({
      proposal,
      allocated: allocatedByProposalId.get(proposal.id),
      currentEmails,
    }),
  );

  if (recipients.length === 0) {
    return { ok: false, reason: 'noRecipients' };
  }

  // Stable order: the batch sender's idempotency keys are chunk-index based,
  // so a retry must rebuild the same list in the same order.
  recipients.sort(
    (a, b) =>
      a.proposalProfileId.localeCompare(b.proposalProfileId) ||
      a.email.localeCompare(b.email),
  );

  return {
    ok: true,
    notification: {
      processTitle: instance.name,
      processProfileSlug: instance.profile.slug,
      messages,
      recipients,
    },
  };
}

/**
 * One message per (author, proposal): a co-authored proposal mails every
 * collaborator, and an author with two proposals hears about each. Dedup is
 * per inbox within the proposal, so a duplicated `profileUsers` row can't
 * double up. `allocated` is `undefined` for a proposal the result row did not
 * select, and `null` for one it selected without an amount.
 */
function toRecipients({
  proposal,
  allocated,
  currentEmails,
}: {
  proposal: {
    id: string;
    profileId: string;
    proposalData: unknown;
    profile: {
      name: string;
      profileUsers: Array<{
        authUserId: string;
        name: string | null;
        email: string | null;
      }>;
    };
  };
  allocated: string | null | undefined;
  /** Live `auth.users` addresses, keyed by auth user id. */
  currentEmails: Map<string, string>;
}): Array<ResultNotificationRecipient> {
  const outcome: ResultNotificationOutcome =
    allocated === undefined ? 'notFunded' : 'funded';
  const amount =
    outcome === 'funded'
      ? formatResultAmount({
          allocated: allocated ?? null,
          budget: (proposal.proposalData as { budget?: unknown } | null)
            ?.budget,
        })
      : '';

  const seen = new Set<string>();

  return proposal.profile.profileUsers
    .map((profileUser) => ({
      ...profileUser,
      // `profileUsers.email` is an insert-time snapshot nothing syncs, so an
      // author who changed their address would be told the outcome at the old
      // one. Prefer the live `auth.users` row, exactly as
      // `listProcessParticipants` does.
      email: currentEmails.get(profileUser.authUserId) ?? profileUser.email,
    }))
    .filter(hasEmail)
    .flatMap((profileUser) => {
      const key = profileUser.email.toLowerCase();
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);

      return [
        {
          email: profileUser.email,
          proposalProfileId: proposal.profileId,
          outcome,
          values: {
            // A registered account can carry no name, and the shipped default
            // copy opens "Hi {{name}},". Emails are English-only, so the
            // fallback belongs here rather than in a dictionary.
            name: profileUser.name || 'there',
            proposal: proposal.profile.name,
            amount,
          },
        },
      ];
    });
}

/** Live addresses for the given auth users, keyed by id. */
async function readCurrentEmails(
  authUserIds: Array<string>,
): Promise<Map<string, string>> {
  if (authUserIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ id: authUsers.id, email: authUsers.email })
    .from(authUsers)
    .where(inArray(authUsers.id, [...new Set(authUserIds)]));

  return new Map(
    rows.flatMap(({ id, email }) => (email ? [[id, email] as const] : [])),
  );
}

/**
 * The copy the admin wrote, read back off the exact transition row they stamped
 * it on. Addressed by id rather than "the latest transition": any row written
 * afterwards — a revert-and-readvance inside the debounce window, an archive —
 * would hide the messages and silently send nothing.
 */
async function readComposedMessages(
  transitionHistoryId: string,
): Promise<ResultNotificationMessages | undefined> {
  const [row] = await db
    .select({ transitionData: stateTransitionHistory.transitionData })
    .from(stateTransitionHistory)
    .where(eq(stateTransitionHistory.id, transitionHistoryId))
    .limit(1);

  const transitionData = row?.transitionData as TransitionData | null;

  // Re-validated, not just null-checked: `transitionData` is a shared jsonb bag
  // several writers touch, and a half-written object would reach the renderer
  // as `template: undefined` and throw inside the send step.
  const parsed = resultNotificationMessagesSchema.safeParse(
    transitionData?.manualSelection?.resultNotifications,
  );

  return parsed.success ? parsed.data : undefined;
}
