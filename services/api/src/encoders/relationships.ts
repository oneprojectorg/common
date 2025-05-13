import { organizationRelationships } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

export const relationshipEncoder = createSelectSchema(
  organizationRelationships,
).pick({
  id: true,
  sourceOrganizationId: true,
  targetOrganizationId: true,
  relationshipType: true,
});

export type Relationship = z.infer<typeof relationshipEncoder>;
