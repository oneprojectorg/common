import { objectsInStorage } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const storageItemEncoder = createSelectSchema(objectsInStorage)
  .pick({
    id: true,
    name: true,
    // TODO: add metadata but make sure TRPC can resolve the type properly
  })
  .extend({
    metadata: z.object({
      eTag: z.string(),
      size: z.number(),
      mimetype: z.string(),
      cacheControl: z.string(),
      lastModified: z.string(),
      contentLength: z.number(),
      httpStatusCode: z.number(),
    }),
  });
