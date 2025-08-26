import { relations } from 'drizzle-orm';
import { index, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

import { autoId, serviceRolePolicies, timestamps } from '../../helpers';
import { attachments } from './attachments.sql';
import { profiles } from './profiles.sql';
import { proposals } from './proposals.sql';

export const proposalAttachments = pgTable(
  'decision_proposal_attachments',
  {
    id: autoId().primaryKey(),
    proposalId: uuid()
      .notNull()
      .references(() => proposals.id, {
        onDelete: 'cascade',
      }),
    attachmentId: uuid()
      .notNull()
      .references(() => attachments.id, {
        onDelete: 'cascade',
      }),
    uploadedBy: uuid()
      .notNull()
      .references(() => profiles.id, {
        onDelete: 'cascade',
      }),
    ...timestamps,
  },
  (table) => [
    ...serviceRolePolicies,
    index().on(table.id).concurrently(),
    index().on(table.proposalId).concurrently(),
    index().on(table.attachmentId).concurrently(),
    index().on(table.uploadedBy).concurrently(),
    // Ensure unique attachment per proposal
    unique('dec_proposal_attachment_unq').on(
      table.proposalId,
      table.attachmentId,
    ),
  ],
);

export const proposalAttachmentsRelations = relations(
  proposalAttachments,
  ({ one }) => ({
    proposal: one(proposals, {
      fields: [proposalAttachments.proposalId],
      references: [proposals.id],
    }),
    attachment: one(attachments, {
      fields: [proposalAttachments.attachmentId],
      references: [attachments.id],
    }),
    uploader: one(profiles, {
      fields: [proposalAttachments.uploadedBy],
      references: [profiles.id],
    }),
  }),
);
