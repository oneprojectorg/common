import { getHandler } from '@op/workflows';

// Mounts the handler for our @op/workflows package to handle event-driven workflows and tasks
export const { GET, POST, PUT } = getHandler();

/**
 * How long one invocation of this endpoint may run.
 *
 * This bounds a single Inngest *step*, not a whole run. Inngest calls this
 * endpoint once per step and the step executes inside that request, so a run of
 * five short steps never approaches this while a run of one long step can blow
 * straight through it.
 *
 * Left unset, this took the platform default and the theme analysis — whose
 * heaviest step is a corpus read plus a model call over a prompt of roughly
 * 130 KB — was killed mid-flight with `FUNCTION_INVOCATION_TIMEOUT`. That kill
 * is not an exception: no `catch` runs, so the workflow cannot record why it
 * died, and the record is left saying `processing` forever.
 *
 * 800s is the Vercel ceiling for Pro with Fluid compute. The existing 120s on
 * the tRPC route already rules out Hobby, whose ceiling is 60s. If a deploy
 * rejects this value the project is on a lower ceiling — drop it to 600, which
 * is what the platform was already allowing when the timeout was observed.
 *
 * Raising it is the smaller half of the fix. The steps themselves now bound
 * their model calls (`THEME_ANALYSIS_PASS_TIMEOUT_MS`), so a slow provider ends
 * as a reported failure with a cause rather than as a platform kill — this
 * ceiling is the backstop, not the mechanism.
 */
export const maxDuration = 800;
