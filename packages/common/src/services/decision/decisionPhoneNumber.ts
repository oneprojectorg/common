import { db } from '@op/db/client';

import {
  type PhoneNumber,
  safeParsePhoneNumber,
} from '../notification/schemas';

export interface DecisionPhoneNumberTarget {
  phone: PhoneNumber;
  instanceId: string;
  slug: string;
}

export const findDecisionPhoneNumber = async ({
  phone,
  channel = 'sms',
}: {
  phone: string;
  channel?: 'sms' | 'whatsapp';
}): Promise<DecisionPhoneNumberTarget | null> => {
  const parsed = safeParsePhoneNumber(phone);
  if (!parsed.success) {
    return null;
  }

  const number = await db.query.decisionPhoneNumbers.findFirst({
    where: { phoneNumber: parsed.data, channel },
    columns: { processInstanceId: true },
    with: {
      processInstance: {
        columns: { id: true },
        with: { profile: { columns: { slug: true } } },
      },
    },
  });

  if (!number?.processInstance.profile) {
    return null;
  }

  return {
    phone: parsed.data,
    instanceId: number.processInstanceId,
    slug: number.processInstance.profile.slug,
  };
};
