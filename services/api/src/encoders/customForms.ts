import { customFormSchema, customFormSubmissionSchema } from '@op/common';

/** Re-export the @op/common wire schemas so the API contract is co-located
 *  with the rest of the encoders the client consumes. */
export const customFormEncoder = customFormSchema;
export const customFormSubmissionEncoder = customFormSubmissionSchema;
