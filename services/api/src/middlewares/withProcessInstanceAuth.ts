import { cache } from '@op/cache';
import { UnauthorizedError, getAllowListUser } from '@op/common';
import type { ParticipationMode } from '@op/common';
import { db } from '@op/db/client';
import { processInstances, proposals } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { eq } from 'drizzle-orm';

import { getCachedAuthUser } from '../supabase/server';
import type { MiddlewareBuilderBase, TContext } from '../types';

export interface ProcessInstanceAuthCtxRequired {
  user: User;
  /** Resolved instance participation mode; null when not a public instance. */
  instanceMode: ParticipationMode | null;
  /**
   * `true` when the caller cleared the gate via the public-mode path and the
   * service layer should bypass its per-actor access check. Handlers forward
   * this to the service rather than re-deriving from `instanceMode`.
   */
  skipAccessCheck: boolean;
}

export interface ProcessInstanceAuthCtxOptional {
  user: User | null;
  instanceMode: ParticipationMode | null;
  skipAccessCheck: boolean;
}

/**
 * Resolves the participation mode for the instance referenced by the call's
 * raw input. Accepts either a direct `processInstanceId` (e.g. listProposals)
 * or a `proposalId` that the middleware joins through to its instance (e.g.
 * submitProposal). Returns `null` when neither key is present or the row is
 * missing — the gate treats `null` as non-public.
 */
async function resolveInstanceMode(
  rawInput: unknown,
): Promise<ParticipationMode | null> {
  if (!rawInput || typeof rawInput !== 'object') return null;
  const input = rawInput as Record<string, unknown>;

  if (typeof input.processInstanceId === 'string') {
    const rows = await db
      .select({ instanceData: processInstances.instanceData })
      .from(processInstances)
      .where(eq(processInstances.id, input.processInstanceId))
      .limit(1);
    const data = rows[0]?.instanceData as { mode?: ParticipationMode } | null;
    return data?.mode ?? null;
  }

  if (typeof input.proposalId === 'string') {
    const rows = await db
      .select({ instanceData: processInstances.instanceData })
      .from(proposals)
      .innerJoin(
        processInstances,
        eq(processInstances.id, proposals.processInstanceId),
      )
      .where(eq(proposals.id, input.proposalId))
      .limit(1);
    const data = rows[0]?.instanceData as { mode?: ParticipationMode } | null;
    return data?.mode ?? null;
  }

  return null;
}

async function resolveUser(ctx: TContext): Promise<User | null> {
  const data = await getCachedAuthUser(ctx);
  if (data && !data.error && data.data?.user) {
    return data.data.user;
  }
  return null;
}

/**
 * Closed-network gate: mirrors `withAuthenticated`'s rules (no anonymous, no
 * unconfirmed email, allowList enforced for non-oneproject domains). Used
 * when the instance is NOT tagged `mode: 'public'`.
 */
async function enforceClosedNetwork(user: User | null): Promise<User> {
  if (!user) {
    throw new UnauthorizedError(
      'This action requires an authenticated session',
    );
  }
  if (user.is_anonymous) {
    throw new UnauthorizedError(
      'Anonymous users are not allowed on this instance',
    );
  }
  if (user.confirmed_at === null) {
    throw new UnauthorizedError('User has not confirmed their email address');
  }

  if (user.email?.toLowerCase().split('@')[1] !== 'oneproject.org') {
    const allowedUserEmail = await cache<ReturnType<typeof getAllowListUser>>({
      type: 'allowList',
      params: [user.email?.toLowerCase()],
      fetch: () => getAllowListUser({ email: user.email?.toLowerCase() }),
      options: { ttl: 30 * 60 * 1000 },
    });
    if (!allowedUserEmail) {
      throw new UnauthorizedError();
    }
  }

  return user;
}

/**
 * Mode-aware auth for instance-scoped endpoints — see
 * COLUMBUS_TECH_DECISIONS.md §5–6.
 *
 * On `mode: 'public'` instances anonymous and (when `requireUser:false`)
 * no-JWT requests are accepted. On any other instance the closed-network
 * gate runs unchanged: only authed, allowList-verified users get through.
 */
export const withProcessInstanceAuthRequired: MiddlewareBuilderBase<
  ProcessInstanceAuthCtxRequired
> = async ({ ctx, next, getRawInput }) => {
  const [user, mode] = await Promise.all([
    resolveUser(ctx),
    resolveInstanceMode(await getRawInput()),
  ]);

  if (mode === 'public') {
    if (!user) {
      throw new UnauthorizedError(
        'This action requires an authenticated session',
      );
    }
    return next({
      ctx: { ...ctx, user, instanceMode: mode, skipAccessCheck: true },
    });
  }

  const verifiedUser = await enforceClosedNetwork(user);
  return next({
    ctx: {
      ...ctx,
      user: verifiedUser,
      instanceMode: mode,
      skipAccessCheck: false,
    },
  });
};

export const withProcessInstanceAuthOptional: MiddlewareBuilderBase<
  ProcessInstanceAuthCtxOptional
> = async ({ ctx, next, getRawInput }) => {
  const [user, mode] = await Promise.all([
    resolveUser(ctx),
    resolveInstanceMode(await getRawInput()),
  ]);

  if (mode === 'public') {
    return next({
      ctx: { ...ctx, user, instanceMode: mode, skipAccessCheck: true },
    });
  }

  const verifiedUser = await enforceClosedNetwork(user);
  return next({
    ctx: {
      ...ctx,
      user: verifiedUser,
      instanceMode: mode,
      skipAccessCheck: false,
    },
  });
};
