import { clipSmsText } from '@op/common/client';

const COMMENT_CONTEXT_LENGTH = 53;

export const clipCommentContext = (text: string): string =>
  clipSmsText(text.trim(), COMMENT_CONTEXT_LENGTH);
