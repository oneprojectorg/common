import { type TaskMeta, beforeAll } from 'vitest';

import './taskMeta';

const hasFileMeta = (suite: object): suite is { file: { meta: TaskMeta } } =>
  'file' in suite &&
  typeof suite.file === 'object' &&
  suite.file !== null &&
  'meta' in suite.file;

/**
 * Opts the calling file out of the per-test transaction. Use it only for a
 * test whose subject cannot live inside one transaction: a race between
 * connections, a constraint violation the service lets surface, or a time
 * window that needs `now()` to move between two writes. Such a file cleans
 * up its own rows, as every file did before the transaction harness.
 */
export const withoutTestTransactions = () => {
  beforeAll(({}, suite) => {
    if (hasFileMeta(suite)) {
      suite.file.meta.testTransactions = 'off';
    }
  });
};
