import { modules, profileModules } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const moduleEncoder = createSelectSchema(modules).pick({
  id: true,
  slug: true,
  name: true,
  description: true,
  isActive: true,
  metadata: true,
});

export const profileModuleEncoder = createSelectSchema(profileModules)
  .pick({
    profileId: true,
    moduleId: true,
    enabledAt: true,
    enabledBy: true,
    config: true,
  })
  .extend({
    module: moduleEncoder,
  });

export type Module = z.infer<typeof moduleEncoder>;
export type ProfileModule = z.infer<typeof profileModuleEncoder>;
