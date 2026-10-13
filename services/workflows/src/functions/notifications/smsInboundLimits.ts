export const SMS_RATE_LIMIT_PER_NUMBER = 100;
export const SMS_RATE_LIMIT_PERIOD = '1h';
export const SMS_THROTTLE_LIMIT = 200;
export const SMS_THROTTLE_PERIOD = '1h';

export const smsNumberRateLimit = (numberKey: string) =>
  ({
    key: numberKey,
    limit: SMS_RATE_LIMIT_PER_NUMBER,
    period: SMS_RATE_LIMIT_PERIOD,
  }) as const;
