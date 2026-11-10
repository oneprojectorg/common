import {
  PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS,
  expirePersonalDataExport,
} from '@op/common';
import { Events, inngest } from '@op/events';

const { personalDataExportCompleted } = Events;

export const expirePersonalDataExportFile = inngest.createFunction(
  { id: 'expirePersonalDataExportFile' },
  { event: personalDataExportCompleted.name },
  async ({ event, step }) => {
    const data = personalDataExportCompleted.schema.parse(event.data);

    await step.sleep('hold-file', PERSONAL_DATA_EXPORT_FILE_LIFETIME_MS);
    await step.run('expire-file', () => expirePersonalDataExport(data));
  },
);
