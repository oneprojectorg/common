/**
 * Click coalescing for the proposal like/follow toggles.
 *
 * A burst of presses has to move the UI on every press while sending far fewer
 * requests than there were presses. This keeps, per target, what the user wants
 * and what was last sent, and runs one request at a time — re-reading the
 * intent after each one rather than queueing a request per click. Ten taps are
 * at most two requests: the one already going, and one to correct it.
 *
 * The state is module-scoped and keyed, not per hook instance: the same
 * proposal can be mounted twice at once (a card in the list and the detail
 * view), and two drains for one relationship would double the requests against
 * a 20-per-10s limit and race each other's reconciles.
 *
 * No React and no tRPC in here on purpose — everything it touches arrives
 * through `io`, so the loop is testable on its own.
 */

/** The outside world, re-supplied on every request so it can't go stale. */
export interface RelationshipDrainIo {
  /** Write `next` to the server. Rejecting ends the burst. */
  send: (next: boolean) => Promise<void>;
  /** Drop the optimistic state and refetch the truth. */
  reconcile: () => Promise<void>;
  onError: (error: unknown) => void;
}

interface DrainState {
  /** What the user wants. `undefined` once the burst has been settled. */
  desired?: boolean;
  /** What was last written to the server during this burst. */
  sent?: boolean;
  /** Held for the whole loop, reconciles included. */
  draining: boolean;
  io: RelationshipDrainIo;
}

const drains = new Map<string, DrainState>();

/**
 * Record what the user wants for `key` and make sure a drain is running.
 *
 * Returns when the drain this call belongs to has finished — immediately if one
 * was already running, since that loop will pick the new intent up itself.
 */
export function requestRelationship(
  key: string,
  next: boolean,
  io: RelationshipDrainIo,
): Promise<void> {
  const state = drains.get(key) ?? { draining: false, io };

  // Newest callbacks win: a running loop re-reads them each pass, so it sends
  // through the latest render's mutations rather than the ones it started with.
  state.io = io;
  state.desired = next;
  drains.set(key, state);

  return runDrain(key, state);
}

async function runDrain(key: string, state: DrainState): Promise<void> {
  if (state.draining) {
    return;
  }

  state.draining = true;

  // Forget this burst and pull the truth back in. Stays inside the loop so a
  // click that lands during the refetch is picked up here rather than by a
  // second drain racing the queries this one just kicked off.
  const settle = async () => {
    state.desired = undefined;
    state.sent = undefined;
    await state.io.reconcile();
  };

  try {
    while (state.desired !== undefined) {
      const target = state.desired;

      if (target === state.sent) {
        await settle();
        continue;
      }

      try {
        await state.io.send(target);
        state.sent = target;
      } catch (error) {
        state.io.onError(error);

        // `continue`, not `break`: settle() cleared the burst, so with no
        // further press the loop condition ends it here anyway — there is no
        // retry. A click that landed during the reconcile is the case `break`
        // got wrong; it couldn't start its own drain (the lease is still held)
        // and was dropped silently, leaving the cache flipped against the
        // server for the next press to read.
        await settle();
        continue;
      }
    }
  } finally {
    state.draining = false;

    // Idle and empty — settle() cleared both fields — so drop it rather than
    // keep an entry per proposal the viewer has ever touched.
    if (state.desired === undefined && drains.get(key) === state) {
      drains.delete(key);
    }
  }
}
