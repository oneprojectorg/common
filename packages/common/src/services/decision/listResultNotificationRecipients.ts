import { db, eq, inArray } from '@op/db/client';
import {
  decisionProcessResultSelections,
  profiles,
  stateTransitionHistory,
  users,
} from '@op/db/schema';

import { hasEmail } from '../../utils/email';
import {
  type EmailRecipient,
  listMemberProfileRecipientsByProfile,
} from '../email/recipients';
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

/** Emails are English-only, so the greeting fallback lives here. */
const DEFAULT_GREETING_NAME = 'there';

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
    with: { profile: true },
  });

  const reachable = proposals.filter(isProposalReachable);

  // Addresses come from the shared resolver — the single place that knows
  // delivery goes to `auth.users.email`, so this send can't drift from the
  // rest of them. Batched: a phase-wide fan-out would otherwise put one query
  // per proposal on the wire.
  const audiences = await listMemberProfileRecipientsByProfile(
    reachable.map(({ profileId }) => profileId),
  );

  // Names need their own read: `EmailRecipient` carries no display name, and
  // `{{name}}` has to come from the author's own profile.
  const names = await readAuthorNames(
    [...audiences.values()].flat().map(({ authUserId }) => authUserId),
  );

  const recipients = reachable.flatMap((proposal) =>
    toRecipients({
      proposal,
      allocated: allocatedByProposalId.get(proposal.id),
      audience: audiences.get(proposal.profileId) ?? [],
      names,
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
 * per inbox within the proposal, so two access rows for one person can't
 * double up. `allocated` is `undefined` for a proposal the result row did not
 * select, and `null` for one it selected without an amount.
 */
function toRecipients({
  proposal,
  allocated,
  audience,
  names,
}: {
  proposal: {
    id: string;
    profileId: string;
    proposalData: unknown;
    profile: { name: string };
  };
  allocated: string | null | undefined;
  /** This proposal's authors, from the shared recipient resolver. */
  audience: Array<EmailRecipient>;
  /** Display names, keyed by auth user id. */
  names: Map<string, string>;
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

  return audience.filter(hasEmail).flatMap(({ authUserId, email }) => {
    const key = email.toLowerCase();
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);

    return [
      {
        email,
        proposalProfileId: proposal.profileId,
        outcome,
        values: {
          // The address decides delivery; the name is enrichment. A
          // collaborator who accepted a proposal invite before finishing
          // onboarding has no profile row yet, and losing their greeting
          // beats losing the announcement on a publish that can't be redone.
          name: names.get(authUserId) ?? DEFAULT_GREETING_NAME,
          proposal: proposal.profile.name,
          amount,
        },
      },
    ];
  });
}

/**
 * The display name for each author, from their own profile — the identity
 * record, rather than the `profileUsers` access row. Addresses deliberately do
 * not come from here: `profiles.email` is an unverified public contact field,
 * so delivery stays with the shared resolver.
 *
 * Left-joined and best-effort. `users.profileId` is nullable and an invited
 * collaborator may have no `users` row at all, so a missing name has to mean a
 * generic greeting, never a dropped recipient.
 */
async function readAuthorNames(
  authUserIds: Array<string>,
): Promise<Map<string, string>> {
  if (authUserIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      authUserId: users.authUserId,
      profileName: profiles.name,
      userName: users.name,
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.id, users.profileId))
    .where(inArray(users.authUserId, [...new Set(authUserIds)]));

  return new Map(
    rows.flatMap(({ authUserId, profileName, userName }) => {
      const name = profileName ?? userName;
      return name ? [[authUserId, name] as const] : [];
    }),
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
