import { describe, expect, it } from 'vitest';

import { personalDataExportRecordSchema } from './schemas';

const record = {
  exportId: '11111111-1111-4111-8111-111111111111',
  userId: '33333333-3333-4333-8333-333333333333',
  status: 'completed',
  fileName: 'personal_data_export_1.json',
  createdAt: new Date().toISOString(),
};

describe('personalDataExportRecordSchema', () => {
  it('accepts a well-formed record', () => {
    expect(personalDataExportRecordSchema.safeParse(record).success).toBe(true);
  });

  // The status read builds the storage key from `userId`, so a record carrying
  // path separators would sign a URL against a neighbouring subject's prefix.
  it.each(['../44444444-4444-4444-8444-444444444444', 'not-a-uuid', ''])(
    'rejects a record whose userId is not a uuid (%p)',
    (userId) => {
      expect(
        personalDataExportRecordSchema.safeParse({ ...record, userId }).success,
      ).toBe(false);
    },
  );

  it('rejects a record whose exportId is not a uuid', () => {
    expect(
      personalDataExportRecordSchema.safeParse({
        ...record,
        exportId: '../other',
      }).success,
    ).toBe(false);
  });
});
