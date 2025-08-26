import { relations } from 'drizzle-orm';
import { bigint, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { organizationUsers } from './organizationUsers.sql';
import { posts } from './posts.sql';
import { profiles } from './profiles.sql';
import { objectsInStorage } from './storage.sql';

export const attachments = pgTable(
  'attachments',
  {
    id: autoId().primaryKey(),
    postId: uuid().references(() => posts.id, {
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
    uploadedBy: uuid().references(() => organizationUsers.id, {
      onDelete: 'cascade',
    }),
    profileId: uuid().references(() => profiles.id, {
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
    index().on(table.profileId).concurrently(),
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
  uploader: one(organizationUsers, {
    fields: [attachments.uploadedBy],
    references: [organizationUsers.id],
  }),
}));
