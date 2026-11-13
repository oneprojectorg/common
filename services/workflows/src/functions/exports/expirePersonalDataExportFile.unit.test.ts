import { InngestTestEngine } from '@inngest/test';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@op/common', () => ({
  PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS: 60 * 60 * 1000,
  PERSONAL_DATA_EXPORT_MAX_RUN_MS: 30 * 60 * 1000,
  expirePersonalDataExport: vi.fn(),
}));

import { expirePersonalDataExport } from '@op/common';
import { Events } from '@op/events';

import { expirePersonalDataExportFile } from './expirePersonalDataExportFile';

const data = {
  exportId: '44444444-4444-4444-8444-444444444444',
  userId: '33333333-3333-4333-8333-333333333333',
  fileName: 'personal_data_export_1.json',
};

describe('expirePersonalDataExportFile', () => {
  it('holds the file for its lifetime past the longest run, then expires it', async () => {
    const { ctx, error } = await new InngestTestEngine({
      function: expirePersonalDataExportFile,
    }).execute({
      events: [{ name: Events.personalDataExportFileStored.name, data }],
      // Ends the sleep at once.
      steps: [{ id: 'hold-file', handler: () => null }],
    });

    expect(error).toBeUndefined();
    expect(ctx.step.sleep).toHaveBeenCalledWith('hold-file', 90 * 60 * 1000);
    expect(expirePersonalDataExport).toHaveBeenCalledWith(data);
  });
});
