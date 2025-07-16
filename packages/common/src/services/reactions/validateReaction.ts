import { isValidEmoji } from '../../constants/reactions';

export interface ReactionValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates an emoji reaction for use in the service layer
 * While the backend accepts arbitrary emojis, the service layer
 * maintains restrictions on allowed emojis for UX consistency
 */
export function validateReactionEmoji(emoji: string): ReactionValidationResult {
  if (!emoji || emoji.trim().length === 0) {
    return {
      isValid: false,
      error: 'Emoji cannot be empty',
    };
  }

  if (emoji.length > 50) {
    return {
      isValid: false,
      error: 'Emoji string too long (max 50 characters)',
    };
  }

  // Service layer emoji restrictions
  if (!isValidEmoji(emoji)) {
    return {
      isValid: false,
      error: 'Emoji not allowed. Please use one of the supported emojis.',
    };
  }

  return {
    isValid: true,
  };
}