import { db } from '@op/db/client';

import {
  type PhoneNumber,
  safeParsePhoneNumber,
} from '../notification/schemas';

export interface ChatLineTarget {
  phone: PhoneNumber;
  instanceId: string;
  slug: string;
}

export const findChatLine = async ({
  phone,
}: {
  phone: string;
}): Promise<ChatLineTarget | null> => {
  const parsed = safeParsePhoneNumber(phone);
  if (!parsed.success) {
    return null;
  }

  const line = await db.query.decisionChatLines.findFirst({
    where: { phoneNumber: parsed.data },
    columns: { processInstanceId: true },
    with: {
      processInstance: {
        columns: { id: true },
        with: { profile: { columns: { slug: true } } },
      },
    },
  });

  if (!line?.processInstance.profile) {
    return null;
  }

  return {
    phone: parsed.data,
    instanceId: line.processInstanceId,
    slug: line.processInstance.profile.slug,
  };
};
