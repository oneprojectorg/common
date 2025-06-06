import { projects } from '@op/db/schema';
import { createSelectSchema } from 'drizzle-zod';

export const projectEncoder = createSelectSchema(projects);
