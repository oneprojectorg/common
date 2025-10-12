import { EventSchemas, Inngest } from 'inngest';
import type { z } from 'zod';

import { Events } from './types';

type EventSchemaMap = {
  [K in keyof typeof Events as (typeof Events)[K]['name']]: {
    name: (typeof Events)[K]['name'];
    data: z.infer<(typeof Events)[K]['schema']>;
  };
};

export const inngest = new Inngest({
  id: process.env.WORKFLOW_APP_ID ?? 'common',
  schemas: new EventSchemas().fromRecord<EventSchemaMap>(),
});

export const event = inngest;
