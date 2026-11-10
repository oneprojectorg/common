import { InngestTestEngine } from '@inngest/test';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/common', () => ({
  collectPersonalData: vi.fn(async () => ({ truncatedSections: [] })),
  patchExportRecord: vi.fn(),
  personalDataExportCacheKey: (exportId: string) =>
    `export:personalData:${exportId}`,
  personalDataExportFileName: () => 'personal_data_export_1.json',
  personalDataExportFilePath: (userId: string, fileName: string) =>
    `user/${userId}/personal-data/${fileName}`,
  releaseActivePersonalDataExport: vi.fn(),
  storeExportFile: vi.fn(),
}));
vi.mock('@op/common/realtime', () => ({
  Channels: { personalDataExport: (exportId: string) => `export:${exportId}` },
}));
vi.mock('@op/logging', () => ({ logger: { error: vi.fn() } }));
vi.mock('./notifyExportChanged', () => ({ notifyExportChanged: vi.fn() }));

import {
  patchExportRecord,
  releaseActivePersonalDataExport,
  storeExportFile,
} from '@op/common';
import { Events } from '@op/events';
import { NonRetriableError } from 'inngest';

import { exportPersonalData } from './exportPersonalData';

const EXPORT_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = '33333333-3333-4333-8333-333333333333';

const execute = () =>
  new InngestTestEngine({ function: exportPersonalData }).execute({
    events: [
      {
        name: Events.personalDataExportRequested.name,
        data: { exportId: EXPORT_ID, userId: USER_ID },
      },
    ],
    // Stands in for the Inngest API, which `step.sendEvent` would call.
    steps: [{ id: 'schedule-expiry', handler: () => ({ ids: [] }) }],
  });

const expiryEvent = {
  name: Events.personalDataExportFileStored.name,
  data: {
    exportId: EXPORT_ID,
    userId: USER_ID,
    fileName: 'personal_data_export_1.json',
  },
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe('exportPersonalData', () => {
  it('schedules the file expiry and releases the claim when the export completes', async () => {
    const { ctx, error } = await execute();

    expect(error).toBeUndefined();
    expect(ctx.step.sendEvent).toHaveBeenCalledWith(
      'schedule-expiry',
      expiryEvent,
    );
    expect(releaseActivePersonalDataExport).toHaveBeenCalledWith({
      userId: USER_ID,
      exportId: EXPORT_ID,
    });
  });

  it('schedules the file expiry before it writes the completed status', async () => {
    vi.mocked(patchExportRecord).mockImplementation(async (_, patch) => {
      if (patch.status === 'completed') {
        throw new NonRetriableError('Redis unavailable');
      }
    });

    const { ctx, error } = await execute();

    expect(error).toMatchObject({ message: 'Redis unavailable' });
    expect(ctx.step.sendEvent).toHaveBeenCalledWith(
      'schedule-expiry',
      expiryEvent,
    );
  });

  it('schedules no file expiry when the upload fails', async () => {
    vi.mocked(storeExportFile).mockRejectedValue(
      new NonRetriableError('Storage down'),
    );

    const { ctx, error } = await execute();

    expect(error).toMatchObject({ message: 'Storage down' });
    expect(ctx.step.sendEvent).not.toHaveBeenCalled();
  });
});
