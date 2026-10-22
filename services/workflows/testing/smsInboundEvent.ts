import type { SmsKeyword } from '@op/core/sms';
import { Events } from '@op/events';

export const smsInboundEvent = ({
  from,
  code = null,
  keyword = null,
  argument = null,
  messageSid = `SM-${from}-${code ?? argument ?? keyword ?? 'text'}`,
}: {
  from: string;
  code?: string | null;
  keyword?: SmsKeyword | null;
  argument?: string | null;
  messageSid?: string;
}) => ({
  name: Events.smsInboundReceived.name,
  data: { from, messageSid, code, keyword, argument },
});
