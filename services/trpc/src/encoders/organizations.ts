import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

import { objectsInStorage, organizations } from '@op/db/schema';

import { linksEncoder } from './links';
import { projectEncoder } from './projects';

export const storageItemEncoder = createSelectSchema(objectsInStorage).pick({
  id: true,
  name: true,
  // TODO: add metadata but make sure TRPC can resolve the type properly
});
export const organizationsEncoder = createSelectSchema(organizations)
  .pick({
    id: true,
    name: true,
    city: true,
    state: true,
    description: true,
    mission: true,
    email: true,
    website: true,
    isOfferingFunds: true,
    isReceivingFunds: true,
  })
  .extend({
    projects: z.array(projectEncoder),
    links: z.array(linksEncoder),
    headerImage: storageItemEncoder.nullable(),
    avatarImage: storageItemEncoder.nullable(),
  });

export type Organization = z.infer<typeof organizationsEncoder>;
