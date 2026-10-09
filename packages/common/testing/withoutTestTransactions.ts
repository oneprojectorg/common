import { type TaskMeta, beforeAll } from 'vitest';

import './taskMeta';

const hasFileMeta = (suite: object): suite is { file: { meta: TaskMeta } } =>
  'file' in suite &&
  typeof suite.file === 'object' &&
  suite.file !== null &&
  'meta' in suite.file;

export const withoutTestTransactions = () => {
  beforeAll(({}, suite) => {
    if (hasFileMeta(suite)) {
      suite.file.meta.testTransactions = 'off';
    }
  });
};
