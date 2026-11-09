import { z } from 'zod';

import { list } from '../../../utils/pagination';

/** A stored JSON Schema row. Rows are immutable; a new version is a new row. */
export const formSchemaSchema = z.object({
  id: z.uuid(),
  processInstanceId: z.uuid(),
  /** The previous version; null for the first one. */
  parentId: z.uuid().nullable(),
  name: z.string(),
  schema: z.record(z.string(), z.unknown()),
  /** md5 of the schema, computed by the database. */
  schemaHash: z.string().nullable(),
  createdByProfileId: z.uuid().nullable(),
  createdAt: z.string().nullable(),
});

export type FormSchemaDTO = z.infer<typeof formSchemaSchema>;

export const formSchemaRefSchema = z.object({
  formSchemaId: z.uuid(),
});

export type FormSchemaRef = z.infer<typeof formSchemaRefSchema>;

export const formSchemasListSchema = list(formSchemaSchema);

export type FormSchemasList = z.infer<typeof formSchemasListSchema>;
