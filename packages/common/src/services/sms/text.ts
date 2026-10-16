export const SMS_MAX_BODY_LENGTH = 1600;

export const SMS_ELLIPSIS = '...';

export const clipSmsText = (text: string, max: number): string =>
  text.length <= max
    ? text
    : `${text.slice(0, Math.max(0, max - SMS_ELLIPSIS.length)).trimEnd()}${SMS_ELLIPSIS}`;
