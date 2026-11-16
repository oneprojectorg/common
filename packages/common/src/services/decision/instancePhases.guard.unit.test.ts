import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Server code reads phases off a resolved instance (`instance.phases`), never
 * off the blob. A punch-list: an unlisted read fails, and so does a listed
 * file that no longer reads the blob.
 */

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));

const SCANNED_DIRS = [
  'packages/common/src',
  'services/api/src',
  'services/workflows/src',
];

const PHASE_HELPERS =
  'getPhaseRubricTemplate|getPhaseProposalTemplate|resolvePhaseTemplate|getPhaseReviewSettings|resolveReviewSettings|getPreviousReviewPhases|getPreviousPhases|getPhaseIndex|isPhaseAtOrBefore|hasPhaseEnded';

const BLOB_READS = [
  /instanceData\??\.phases/,
  /getInstancePhases\(/,
  // A blob handed to a helper that reads its phases.
  new RegExp(`\\b(?:${PHASE_HELPERS})\\(\\s*[\\w.?]*[iI]nstanceData\\s*[,)]`),
];

const ALLOWED: Record<string, string> = {
  'packages/common/src/services/decision/instancePhases.ts':
    'the resolver: its blob fallback',
  'packages/common/src/services/decision/schemas/instanceData.ts':
    'defines getInstancePhases',
  'packages/common/src/services/decision/createInstanceFromTemplate.ts':
    'writes the blob',
  'packages/common/src/services/decision/getUpdatedInstanceData.ts':
    'writes the blob',
  'packages/common/src/services/decision/assertVoterCostField.ts':
    'validates the blob about to be written',
  'packages/common/src/services/decision/createPhase.ts':
    'checks the blob before minting the first row',
  'packages/common/src/services/decision/utils/instance.ts':
    "reads the client's wire instanceData",
};

describe('phase reads', () => {
  const offenders = SCANNED_DIRS.flatMap((dir) =>
    sourceFilesIn(dir).filter((file) => readsBlobPhases(file)),
  );

  it('read phases off the resolved instance outside the allowlist', () => {
    expect(offenders.filter((file) => !(file in ALLOWED))).toEqual([]);
  });

  it('keeps no stale allowlist entries', () => {
    expect(
      Object.keys(ALLOWED).filter((file) => !offenders.includes(file)),
    ).toEqual([]);
  });
});

function sourceFilesIn(dir: string): string[] {
  return readdirSync(join(REPO_ROOT, dir), { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => join(dir, file));
}

function readsBlobPhases(file: string): boolean {
  const code = readFileSync(join(REPO_ROOT, file), 'utf8')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/?\*)/.test(line))
    .join('\n');

  return BLOB_READS.some((pattern) => pattern.test(code));
}
