import { relations } from 'drizzle-orm';
import { bigint, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { posts } from './posts.sql';
import { objectsInStorage } from './storage.sql';
import { users } from './users.sql';

export const attachments = pgTable(
  'attachments',
  {
    id: autoId().primaryKey(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, {
        onDelete: 'cascade',
      }),
    storageObjectId: uuid()
      .notNull()
      .references(() => objectsInStorage.id, {
        onDelete: 'cascade',
      }),
    fileName: text().notNull(),
    mimeType: text().notNull(),
    fileSize: bigint({ mode: 'number' }),
    uploadedBy: uuid()
      .notNull()
      .references(() => users.id, {
        onDelete: 'cascade',
      }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.postId).concurrently(),
    index().on(table.storageObjectId).concurrently(),
    index().on(table.uploadedBy).concurrently(),
  ],
);

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  post: one(posts, {
    fields: [attachments.postId],
    references: [posts.id],
  }),
  storageObject: one(objectsInStorage, {
    fields: [attachments.storageObjectId],
    references: [objectsInStorage.id],
  }),
  uploader: one(users, {
    fields: [attachments.uploadedBy],
    references: [users.id],
  }),
}));
