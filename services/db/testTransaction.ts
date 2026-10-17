import { realDb, testTransactionStorage } from './index';

class TestTransactionRollback extends Error {}

export const runInTestTransaction = async <T>(
  run: () => Promise<T>,
): Promise<T> => {
  const box: {
    outcome: { settled: true; value: T } | { settled: false };
    afterRollback: Array<() => Promise<void>>;
  } = { outcome: { settled: false }, afterRollback: [] };

  try {
    await realDb.transaction(async (tx) => {
      const scope = { tx, afterRollback: box.afterRollback };
      const value = await testTransactionStorage.run(scope, run);
      box.outcome = { settled: true, value };
      throw new TestTransactionRollback();
    });
  } catch (error) {
    if (!(error instanceof TestTransactionRollback)) {
      await runAfterRollback(box.afterRollback);
      throw error;
    }
  }

  await runAfterRollback(box.afterRollback);

  const { outcome } = box;
  if (!outcome.settled) {
    throw new Error('runInTestTransaction: the run returned no value');
  }

  return outcome.value;
};

export const afterTestTransaction = (
  fn: () => Promise<void>,
): Promise<void> => {
  const scope = testTransactionStorage.getStore();
  if (!scope) {
    return fn();
  }
  scope.afterRollback.push(fn);
  return Promise.resolve();
};

export const inTestTransaction = (): boolean =>
  testTransactionStorage.getStore() !== undefined;

const runAfterRollback = async (fns: Array<() => Promise<void>>) => {
  for (const fn of fns) {
    await fn();
  }
};
