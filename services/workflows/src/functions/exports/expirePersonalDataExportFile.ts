import {
  PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS,
  PERSONAL_DATA_EXPORT_MAX_RUN_MS,
  expirePersonalDataExport,
} from '@op/common';
import { Events, inngest } from '@op/events';

const { personalDataExportFileStored } = Events;

export const expirePersonalDataExportFile = inngest.createFunction(
  { id: 'expirePersonalDataExportFile' },
  { event: personalDataExportFileStored.name },
  async ({ event, step }) => {
    const data = personalDataExportFileStored.schema.parse(event.data);

    // Sent before the upload; the run ends within MAX_RUN_MS, so the file keeps its full lifetime.
    await step.sleep(
      'hold-file',
      PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS + PERSONAL_DATA_EXPORT_MAX_RUN_MS,
    );
    await step.run('expire-file', () => expirePersonalDataExport(data));
  },
);
