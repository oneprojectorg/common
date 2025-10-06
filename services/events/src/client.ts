import { EventSchemas, Inngest } from 'inngest';

import { WorkflowEvent } from './types';

type Events = {
  [K in WorkflowEvent as K['name']]: K;
};

export const inngest = new Inngest({
  id: process.env.WORKFLOW_APP_ID!,
  schemas: new EventSchemas().fromRecord<Events>(),
});

export const event = inngest;
