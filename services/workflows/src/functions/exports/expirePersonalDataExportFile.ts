import {
  PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS,
  expirePersonalDataExport,
} from '@op/common';
import { Events, inngest } from '@op/events';

const { personalDataExportFileStored } = Events;

export const expirePersonalDataExportFile = inngest.createFunction(
  { id: 'expirePersonalDataExportFile' },
  { event: personalDataExportFileStored.name },
  async ({ event, step }) => {
    const data = personalDataExportFileStored.schema.parse(event.data);

    await step.sleep('hold-file', PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS);
    await step.run('expire-file', () => expirePersonalDataExport(data));
  },
);
