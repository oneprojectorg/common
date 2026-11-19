import { and, db, eq, isNull } from '@op/db/client';
import {
  type Conversation,
  type ConversationItem,
  conversationItems,
  conversations,
  decisionChatSessions,
} from '@op/db/schema';

import { NotFoundError } from '../../utils';
import { getIndividualProfileId } from '../access';
import { ensureChatSession } from '../decision/chatSession';
import {
  type ReplayMessage,
  type StoredModelMessage,
  itemKindFor,
  itemRoleFor,
  messageText,
  storedModelMessageSchema,
} from './modelMessage';

export interface ConversationScope {
  authUserId: string;
  processInstanceId?: string | null;
  phoneNumberId?: string | null;
}

export async function ensureConversation({
  authUserId,
  processInstanceId,
  phoneNumberId,
}: ConversationScope): Promise<Conversation> {
  const profileId = await getIndividualProfileId(authUserId);

  if (processInstanceId) {
    const session = await ensureChatSession({
      processInstanceId,
      authUserId,
      phoneNumberId,
    });
    if (session.conversationId) {
      const existing = await db.query.conversations.findFirst({
        where: { id: session.conversationId },
      });
      if (existing) {
        return existing;
      }
    }
    const [created] = await db
      .insert(conversations)
      .values({
        profileId,
        processInstanceId,
        phoneNumberId: phoneNumberId ?? null,
      })
      .returning();
    if (!created) {
      throw new NotFoundError('Conversation', processInstanceId);
    }
    await db
      .update(decisionChatSessions)
      .set({ conversationId: created.id })
      .where(
        and(
          eq(decisionChatSessions.id, session.id),
          isNull(decisionChatSessions.conversationId),
        ),
      );
    return created;
  }

  const latest = await db.query.conversations.findFirst({
    where: {
      profileId,
      processInstanceId: { isNull: true },
      ...(phoneNumberId ? { phoneNumberId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  if (latest) {
    return latest;
  }
  const [created] = await db
    .insert(conversations)
    .values({ profileId, phoneNumberId: phoneNumberId ?? null })
    .returning();
  if (!created) {
    throw new NotFoundError('Conversation', profileId);
  }
  return created;
}

export async function startNewConversation({
  authUserId,
  processInstanceId,
  phoneNumberId,
}: ConversationScope): Promise<Conversation> {
  const profileId = await getIndividualProfileId(authUserId);
  const [created] = await db
    .insert(conversations)
    .values({
      profileId,
      processInstanceId: processInstanceId ?? null,
      phoneNumberId: phoneNumberId ?? null,
    })
    .returning();
  if (!created) {
    throw new NotFoundError('Conversation', profileId);
  }
  if (processInstanceId) {
    const session = await ensureChatSession({
      processInstanceId,
      authUserId,
      phoneNumberId,
    });
    await db
      .update(decisionChatSessions)
      .set({ conversationId: created.id })
      .where(eq(decisionChatSessions.id, session.id));
  }
  return created;
}

export interface ConversationItemInput {
  message: StoredModelMessage;
  agentId?: string | null;
  promptVersion?: string | null;
  smsMessageId?: string | null;
}

export async function appendConversationItems({
  conversationId,
  runId,
  items,
}: {
  conversationId: string;
  runId: string;
  items: ConversationItemInput[];
}): Promise<ConversationItem[]> {
  if (items.length === 0) {
    return [];
  }
  // One multi-row insert shares a single now(), which would erase the order
  // of the run's items, so each row carries an explicit timestamp offset.
  const base = Date.now();
  const rows = items.map(
    ({ message, agentId, promptVersion, smsMessageId }, index) => {
      const content = storedModelMessageSchema.parse(message);
      return {
        conversationId,
        runId,
        agentId: agentId ?? null,
        kind: itemKindFor(content),
        role: itemRoleFor(content),
        content,
        smsMessageId: smsMessageId ?? null,
        promptVersion: promptVersion ?? null,
        createdAt: new Date(base + index).toISOString(),
      };
    },
  );
  return db.insert(conversationItems).values(rows).returning();
}

export async function listRecentReplayMessages({
  conversationId,
  limit = 10,
}: {
  conversationId: string;
  limit?: number;
}): Promise<ReplayMessage[]> {
  const rows = await db.query.conversationItems.findMany({
    where: { conversationId, kind: 'message' },
    orderBy: { createdAt: 'desc' },
    limit,
  });
  return rows
    .reverse()
    .map((row): ReplayMessage | null => {
      const parsed = storedModelMessageSchema.safeParse(row.content);
      if (!parsed.success || parsed.data.role === 'tool') {
        return null;
      }
      const text = messageText(parsed.data);
      return text ? { role: parsed.data.role, content: text } : null;
    })
    .filter((message): message is ReplayMessage => message !== null);
}
