import { TestDecisionsDataManager } from '@op/common/testing';
import { db } from '@op/db/client';
import { describe, expect, it } from 'vitest';

import {
  clearDecisionChatLine,
  getDecisionChatLine,
  setDecisionChatLine,
} from './decisionChatLine';

const NUMBERS = {
  bind: '+15005550093',
  owner: '+15005550092',
  first: '+15005550094',
  second: '+15005550095',
  shared: '+15005550096',
  clear: '+15005550097',
  spaced: '+15005550098',
  raced: '+15005550099',
} as const;

const readLineByNumber = (phoneNumber: string) =>
  db.query.decisionChatLines.findFirst({
    where: { phoneNumber },
    columns: { processInstanceId: true, phoneNumber: true },
  });

describe.concurrent('decisionChatLine', () => {
  it('given an unbound decision, when an admin binds a number, then the decision reads back with that number', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;

    const result = await setDecisionChatLine({
      instanceId,
      phoneNumber: NUMBERS.bind,
    });

    expect(result).toEqual({ phoneNumber: NUMBERS.bind });
    await expect(getDecisionChatLine({ instanceId })).resolves.toEqual({
      phoneNumber: NUMBERS.bind,
    });
  });

  it('given a bound decision, when an admin binds a number, then the line row belongs to that decision', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;

    await setDecisionChatLine({ instanceId, phoneNumber: NUMBERS.owner });

    await expect(readLineByNumber(NUMBERS.owner)).resolves.toEqual({
      processInstanceId: instanceId,
      phoneNumber: NUMBERS.owner,
    });
  });

  it('given a bound decision, when an admin binds a different number, then the new number replaces the old one', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;
    await setDecisionChatLine({ instanceId, phoneNumber: NUMBERS.first });

    await setDecisionChatLine({ instanceId, phoneNumber: NUMBERS.second });

    await expect(getDecisionChatLine({ instanceId })).resolves.toEqual({
      phoneNumber: NUMBERS.second,
    });
    await expect(readLineByNumber(NUMBERS.first)).resolves.toBeUndefined();
  });

  it('given a number bound to one decision, when an admin binds it to another decision, then it fails as a conflict and the other decision stays unbound', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 2 });
    const [holder, other] = setup.instances;
    if (!holder || !other) {
      throw new Error('expected two instances');
    }
    await setDecisionChatLine({
      instanceId: holder.instance.id,
      phoneNumber: NUMBERS.shared,
    });

    await expect(
      setDecisionChatLine({
        instanceId: other.instance.id,
        phoneNumber: NUMBERS.shared,
      }),
    ).rejects.toMatchObject({ name: 'ConflictError' });

    await expect(
      getDecisionChatLine({ instanceId: other.instance.id }),
    ).resolves.toBeNull();
    await expect(readLineByNumber(NUMBERS.shared)).resolves.toMatchObject({
      processInstanceId: holder.instance.id,
    });
  });

  it('given a free number, when two admins bind it to two decisions at the same time, then one decision holds it and the other fails as a conflict', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 2 });
    const [first, second] = setup.instances;
    if (!first || !second) {
      throw new Error('expected two instances');
    }

    const outcomes = await Promise.allSettled([
      setDecisionChatLine({
        instanceId: first.instance.id,
        phoneNumber: NUMBERS.raced,
      }),
      setDecisionChatLine({
        instanceId: second.instance.id,
        phoneNumber: NUMBERS.raced,
      }),
    ]);

    const fulfilled = outcomes.filter(
      (outcome) => outcome.status === 'fulfilled',
    );
    const rejected = outcomes.filter(
      (outcome) => outcome.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toMatchObject({ name: 'ConflictError' });
    const holder = await readLineByNumber(NUMBERS.raced);
    expect([first.instance.id, second.instance.id]).toContain(
      holder?.processInstanceId,
    );
  });

  it('given a number that is not E.164, when an admin binds it, then it fails as a validation error and nothing is stored', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;

    await expect(
      setDecisionChatLine({ instanceId, phoneNumber: 'not a number' }),
    ).rejects.toMatchObject({ name: 'ValidationError' });

    await expect(getDecisionChatLine({ instanceId })).resolves.toBeNull();
  });

  it('given a number typed with spaces and dashes, when an admin binds it, then the stored number is E.164', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;

    await setDecisionChatLine({ instanceId, phoneNumber: '+1 (500) 555-0098' });

    await expect(getDecisionChatLine({ instanceId })).resolves.toEqual({
      phoneNumber: NUMBERS.spaced,
    });
  });

  it('given a bound decision, when an admin clears the line, then the decision reads as unbound and the number is free', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;
    await setDecisionChatLine({ instanceId, phoneNumber: NUMBERS.clear });

    const result = await clearDecisionChatLine({ instanceId });

    expect(result).toEqual({ cleared: true });
    await expect(getDecisionChatLine({ instanceId })).resolves.toBeNull();
    await expect(readLineByNumber(NUMBERS.clear)).resolves.toBeUndefined();
  });

  it('given an unbound decision, when an admin clears the line, then the call reports nothing cleared', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestDecisionsDataManager(task.id, onTestFinished);
    const setup = await testData.createDecisionSetup({ instanceCount: 1 });
    const instanceId = setup.instance.instance.id;

    await expect(clearDecisionChatLine({ instanceId })).resolves.toEqual({
      cleared: false,
    });
  });

  it('given an unknown decision id, when an admin binds a number, then it fails as not found', async () => {
    await expect(
      setDecisionChatLine({
        instanceId: crypto.randomUUID(),
        phoneNumber: NUMBERS.bind,
      }),
    ).rejects.toMatchObject({ name: 'NotFoundError' });
  });
});
