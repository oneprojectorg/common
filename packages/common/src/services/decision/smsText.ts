export const SMS_MAX_BODY_LENGTH = 1600;

export const clipSmsText = (text: string, max: number): string =>
  text.length <= max
    ? text
    : `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
