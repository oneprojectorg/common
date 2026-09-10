/**
 * Process-level settings resolution: `instanceData.config.*` → defaults. The
 * process-wide counterpart to `phaseSettings`; consumers go through these
 * helpers rather than reading `config` directly.
 *
 * Takes `unknown` because the domain type, the API-encoder `InstanceData`, and
 * the raw jsonb column all reach these helpers — same reason `getInstancePhases`
 * does. The narrowing happens once, here, instead of an assertion per caller.
 */

/**
 * What a process offers its participants, as configured in the Process
 * Builder. Distinct from `DecisionAccess`, which is what THIS VIEWER may do —
 * a capability is off for everyone, including admins.
 *
 * Grouped rather than passed as loose booleans: the UI resolves the whole set
 * once per process and reads members off it, so adding the next capability
 * costs one field instead of a new prop on every component between the
 * instance and the control it governs.
 */
export interface ProcessCapabilities {
  /** Participants may comment on proposals and process updates. */
  comments: boolean;
}

/** Resolves every process capability from the `instanceData` jsonb column. */
export function getProcessCapabilities(
  instanceData: unknown,
): ProcessCapabilities {
  return { comments: areCommentsAllowed(instanceData) };
}

/**
 * Every capability on — the shape a process gets when nothing is configured.
 * Not a grant: the server re-derives each capability from the stored config on
 * every write.
 */
export const ALL_PROCESS_CAPABILITIES: ProcessCapabilities = { comments: true };

/**
 * Participants may comment in this process — the Process Builder's "Allow
 * comments" toggle. Gates the comment surfaces AND the write itself (see
 * `assertPostWriteAccess`), so both read the same rule.
 *
 * Absent = allowed. Every process configured before this toggle existed has
 * working comments, and defaulting to `false` would retire all of them at once.
 */
export function areCommentsAllowed(instanceData: unknown): boolean {
  if (
    instanceData === null ||
    typeof instanceData !== 'object' ||
    !('config' in instanceData)
  ) {
    return true;
  }

  const { config } = instanceData;
  if (
    config === null ||
    typeof config !== 'object' ||
    !('allowComments' in config)
  ) {
    return true;
  }

  const { allowComments } = config;

  return typeof allowComments === 'boolean' ? allowComments : true;
}
