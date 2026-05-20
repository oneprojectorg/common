import { db } from '@op/db/client';
import {
  posts,
  processInstances,
  profileUsers,
  profiles,
} from '@op/db/schema';
import { DecisionUpdateNotificationEmail, OPBatchSend } from '@op/emails';
import { Events, inngest } from '@op/events';
import { and, eq, ne } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { buildDecisionUpdateUrl } from './decisionUpdateUrl';

const { decisionUpdatePosted } = Events;

export const sendDecisionUpdateNotification = inngest.createFunction(
  {
    id: 'sendDecisionUpdateNotification',
  },
  { event: decisionUpdatePosted.name },
  async ({ event, step }) => {
    const { postId, processInstanceId } = decisionUpdatePosted.schema.parse(
      event.data,
    );

    const updateData = await step.run('get-update-data', async () => {
      const authorProfile = alias(profiles, 'author_profile');
      const processProfile = alias(profiles, 'process_profile');

      const [row] = await db
        .select({
          processTitle: processInstances.name,
          processProfileId: processInstances.profileId,
          processProfileSlug: processProfile.slug,
          authorName: authorProfile.name,
          authorEmail: authorProfile.email,
          postContent: posts.content,
        })
        .from(posts)
        .innerJoin(authorProfile, eq(authorProfile.id, posts.profileId))
        .innerJoin(
          processInstances,
          eq(processInstances.id, processInstanceId),
        )
        .leftJoin(
          processProfile,
          eq(processProfile.id, processInstances.profileId),
        )
        .where(eq(posts.id, postId))
        .limit(1);

      return row;
    });

    if (!updateData) {
      console.error('No post or process found for update notification', {
        postId,
        processInstanceId,
      });
      return;
    }

    if (!updateData.processProfileId || !updateData.processProfileSlug) {
      console.error('Process instance has no associated profile/slug', {
        processInstanceId,
      });
      return;
    }

    const participants = await step.run('get-participants', async () => {
      const whereClauses = [
        eq(profileUsers.profileId, updateData.processProfileId!),
      ];
      if (updateData.authorEmail) {
        whereClauses.push(ne(profileUsers.email, updateData.authorEmail));
      }
      return db
        .select({ email: profileUsers.email })
        .from(profileUsers)
        .where(and(...whereClauses));
    });

    if (participants.length === 0) {
      console.warn('No participants to notify for decision update', {
        postId,
        processInstanceId,
      });
      return;
    }

    const updateUrl = buildDecisionUpdateUrl(updateData.processProfileSlug);
    const authorName = updateData.authorName ?? 'A Common user';

    const result = await step.run('send-emails', async () => {
      const emails = participants.map(({ email }) => ({
        to: email,
        subject: DecisionUpdateNotificationEmail.subject(
          authorName,
          updateData.processTitle,
        ),
        component: () =>
          DecisionUpdateNotificationEmail({
            authorName,
            processTitle: updateData.processTitle,
            updateContent: updateData.postContent,
            updateUrl,
          }),
      }));

      const { data, errors } = await OPBatchSend(emails);

      if (errors.length > 0) {
        throw new Error(`Email batch failed: ${JSON.stringify(errors)}`);
      }

      return { sent: data.length };
    });

    return {
      message: `${result.sent} decision update notification(s) sent`,
    };
  },
);
