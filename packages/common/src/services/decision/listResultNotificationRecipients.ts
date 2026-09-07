import { db, eq, inArray } from '@op/db/client';
import {
  authUsers,
  decisionProcessResultSelections,
  profiles,
  stateTransitionHistory,
  users,
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
  const authors = await readAuthorIdentities(
    reachable.flatMap((proposal) =>
      proposal.profile.profileUsers.map(({ authUserId }) => authUserId),
    ),
  );

  const recipients = reachable.flatMap((proposal) =>
    toRecipients({
      proposal,
      allocated: allocatedByProposalId.get(proposal.id),
      authors,
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

/** Who an author is, resolved from their own profile. */
interface AuthorIdentity {
  name: string;
  email: string | null;
}

/**
 * One message per (author, proposal): a co-authored proposal mails every
 * collaborator, and an author with two proposals hears about each. Dedup is
 * per inbox within the proposal, so two access rows for one person can't
 * double up. `allocated` is `undefined` for a proposal the result row did not
 * select, and `null` for one it selected without an amount.
 *
 * `profileUsers` contributes nothing but the `authUserId` — it is an
 * access-control row, and its `name`/`email` are insert-time snapshots of
 * whoever was granted access. The person is their profile.
 */
function toRecipients({
  proposal,
  allocated,
  authors,
}: {
  proposal: {
    id: string;
    profileId: string;
    proposalData: unknown;
    profile: {
      name: string;
      profileUsers: Array<{ authUserId: string }>;
    };
  };
  allocated: string | null | undefined;
  /** Author identities, keyed by auth user id. */
  authors: Map<string, AuthorIdentity>;
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
    .flatMap(({ authUserId }) => {
      const author = authors.get(authUserId);
      return author ? [author] : [];
    })
    .filter(hasEmail)
    .flatMap((author) => {
      const key = author.email.toLowerCase();
      if (seen.has(key)) {
        return [];
      }
      seen.add(key);

      return [
        {
          email: author.email,
          proposalProfileId: proposal.profileId,
          outcome,
          values: {
            name: author.name,
            proposal: proposal.profile.name,
            amount,
          },
        },
      ];
    });
}

/**
 * Who each author is, from the two columns that are actually authoritative:
 * the display name from their own profile, the address from their account.
 *
 * `profileUsers.name` / `.email` are never read — that row records who was
 * granted access to the proposal, and its copies of both are insert-time
 * snapshots nothing keeps in sync. `profiles.email` is not read either: it is
 * an unverified public contact field somebody typed into a profile form, not
 * a mailbox we know reaches them. `auth.users.email` is the address they sign
 * in with, and the one every other notification sender delivers to.
 */
async function readAuthorIdentities(
  authUserIds: Array<string>,
): Promise<Map<string, AuthorIdentity>> {
  if (authUserIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      authUserId: users.authUserId,
      name: profiles.name,
      email: authUsers.email,
    })
    .from(users)
    .innerJoin(profiles, eq(profiles.id, users.profileId))
    .leftJoin(authUsers, eq(authUsers.id, users.authUserId))
    .where(inArray(users.authUserId, [...new Set(authUserIds)]));

  return new Map(
    rows.map(({ authUserId, name, email }) => [authUserId, { name, email }]),
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
